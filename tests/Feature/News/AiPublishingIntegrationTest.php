<?php

use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use App\Services\FacebookPublishingService;
use App\Services\InstagramService;
use App\Services\News\MetaConnections;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    $this->draft = IntelligentNewsDraft::create([
        'created_by' => auth()->id(), 'creation_method' => 'ai', 'headline' => 'Original title',
        'lead' => 'Original lead', 'body' => ['Original body'], 'summary' => 'Original summary',
        'labels' => [], 'sources_used' => [], 'warnings' => [], 'status' => 'draft', 'version' => 1,
        'image' => 'https://images.example.com/news.jpg',
    ]);
    $this->mock(MetaConnections::class, function ($mock) {
        $mock->shouldReceive('platforms')->andReturn(array_map(fn ($id) => ['id' => $id, 'name' => $id, 'status' => 'connected'], ['website', 'facebook', 'instagram']));
    });
});

function saveReviewedAiDraft($test): void
{
    $test->put('/admin/ai-assistant/drafts/'.$test->draft->id, [
        'headline' => 'Reviewed title', 'lead' => 'Reviewed lead', 'body' => ['Reviewed activities', 'Reviewed results'],
    ])->assertRedirect();
    expect($test->draft->fresh()->status)->toBe('draft');
    expect($test->draft->fresh()->reviewed_at)->toBeNull();
    expect(News::count())->toBe(0);
    $test->post('/admin/ai-assistant/drafts/'.$test->draft->id.'/review')->assertRedirect();
    $test->draft->refresh();
}

test('reviewed AI edits publish to selected channels using existing publishers', function (array $platforms) {
    saveReviewedAiDraft($this);
    $caption = "Reviewed title\n\nReviewed lead\n\nReviewed activities\n\nReviewed results";
    $this->mock(FacebookPublishingService::class, function ($mock) use ($platforms, $caption) {
        $mock->shouldReceive('configured')->andReturn(true);
        if (in_array('facebook', $platforms)) {
            $mock->shouldReceive('publish')->once()->with('https://images.example.com/news.jpg', $caption, Mockery::type('array'))->andReturn('fb-1');
        } else {
            $mock->shouldNotReceive('publish');
        }
    });
    $this->mock(InstagramService::class, function ($mock) use ($platforms, $caption) {
        if (in_array('instagram', $platforms)) {
            $mock->shouldReceive('publish')->once()->with('https://images.example.com/news.jpg', $caption, Mockery::type('array'))->andReturn('ig-1');
        } else {
            $mock->shouldNotReceive('publish');
        }
    });
    $response = $this->postJson('/admin/news/drafts/'.$this->draft->id.'/publish', ['version' => $this->draft->version, 'platforms' => $platforms])->assertOk()->assertJsonPath('success', true);
    foreach ($platforms as $platform) {
        $response->assertJsonPath('results.'.($platform === 'website' ? 'application' : $platform).'.success', true);
    }
    expect($this->draft->fresh()->status)->toBe('published');
    expect(News::count())->toBe(in_array('website', $platforms) ? 1 : 0);
    if (in_array('website', $platforms)) {
        expect(News::sole()->title)->toBe('Reviewed title');
        expect(News::sole()->excerpt)->toBe('Reviewed lead');
        expect(News::sole()->content)->toBe("Reviewed lead\n\nReviewed activities\n\nReviewed results");
    }
    Http::assertNothingSent();
})->with([[['website']], [['facebook']], [['instagram']], [['website', 'facebook', 'instagram']]]);

test('AI publication requires review and rejects stale versions', function () {
    $this->postJson('/admin/news/drafts/'.$this->draft->id.'/publish', ['platforms' => ['website'], 'version' => 1])->assertStatus(422);
    saveReviewedAiDraft($this);
    $this->postJson('/admin/news/drafts/'.$this->draft->id.'/publish', ['platforms' => ['website'], 'version' => 1])->assertUnprocessable()->assertJsonValidationErrors('version');
    expect(News::count())->toBe(0);
});

test('partial AI publication keeps reviewed edits and retry does not duplicate successful channels', function () {
    saveReviewedAiDraft($this);
    $this->mock(InstagramService::class, function ($mock) {
        $mock->shouldReceive('publish')->once()->andThrow(ValidationException::withMessages(['platforms' => 'Instagram unavailable']));
    });
    $payload = ['platforms' => ['website', 'instagram'], 'version' => $this->draft->version];
    $this->postJson('/admin/news/drafts/'.$this->draft->id.'/publish', $payload)
        ->assertOk()->assertJsonPath('success', false)->assertJsonPath('results.application.success', true)
        ->assertJsonPath('results.instagram.success', false)
        ->assertJsonPath('retry_url', route('admin.assistant.index', ['draft' => $this->draft->id]));
    expect($this->draft->fresh()->status)->toBe('draft');
    expect($this->draft->fresh()->body)->toBe(['Reviewed activities', 'Reviewed results']);
    expect($this->draft->fresh()->reviewed_at)->not->toBeNull();
    $this->mock(InstagramService::class, fn ($mock) => $mock->shouldReceive('publish')->once()->andReturn('ig-retry'));
    $this->postJson('/admin/news/drafts/'.$this->draft->id.'/publish', $payload)->assertJsonPath('success', true);
    expect(News::count())->toBe(1);
});

test('AI safety block remains enforced after moderator review', function () {
    saveReviewedAiDraft($this);
    $this->draft->qualityEvaluations()->create([
        'evaluation_version' => 'test', 'overall_score' => 20, 'quality_label' => 'needs_review',
        'publish_blocked' => true, 'dimensions' => [], 'claim_checks' => [], 'warnings' => [],
    ]);
    $this->postJson('/admin/news/drafts/'.$this->draft->id.'/publish', ['platforms' => ['website'], 'version' => $this->draft->version])->assertStatus(422);
    expect(News::count())->toBe(0);
});

test('complete social failure retains the reviewed AI draft', function () {
    saveReviewedAiDraft($this);
    $this->mock(InstagramService::class, fn ($mock) => $mock->shouldReceive('publish')->once()->andThrow(new RuntimeException('Provider offline')));
    $this->postJson('/admin/news/drafts/'.$this->draft->id.'/publish', ['platforms' => ['instagram'], 'version' => $this->draft->version])
        ->assertOk()->assertJsonPath('success', false)->assertJsonPath('results.instagram.success', false);
    expect($this->draft->fresh()->status)->toBe('draft');
    expect($this->draft->fresh()->headline)->toBe('Reviewed title');
    expect($this->draft->fresh()->reviewed_at)->not->toBeNull();
    expect(News::count())->toBe(0);
});

test('AI publish confirmation approves the current saved draft without separate review', function () {
    $this->postJson('/admin/news/drafts/'.$this->draft->id.'/publish', [
        'platforms' => ['website'], 'version' => 1, 'confirm_review' => true,
    ])->assertOk()->assertJsonPath('success', true);
    expect($this->draft->fresh()->reviewed_at)->not->toBeNull();
    expect(News::count())->toBe(1);
});

test('AI confirmation cannot approve a stale draft version', function () {
    $this->draft->update(['version' => 2]);
    $this->postJson('/admin/news/drafts/'.$this->draft->id.'/publish', [
        'platforms' => ['website'], 'version' => 1, 'confirm_review' => true,
    ])->assertUnprocessable()->assertJsonValidationErrors('version');
    expect($this->draft->fresh()->reviewed_at)->toBeNull();
    expect(News::count())->toBe(0);
});

test('unified title and content editor preserves paragraphs through publication', function (string $content) {
    $this->put('/admin/ai-assistant/drafts/'.$this->draft->id, [
        'title' => 'Judul hasil tinjauan', 'content' => $content,
    ])->assertRedirect();
    $this->draft->refresh();
    expect($this->draft->subheadline)->toBeNull();
    expect($this->draft->reviewed_at)->toBeNull();
    $this->postJson('/admin/news/drafts/'.$this->draft->id.'/publish', [
        'platforms' => ['website'], 'version' => $this->draft->version, 'confirm_review' => true,
    ])->assertOk();
    expect(News::sole()->title)->toBe('Judul hasil tinjauan');
    expect(News::sole()->content)->toBe($content);
})->with(['Satu paragraf lengkap.', "Pembukaan berita.\n\nKegiatan peserta.\n\nHasil kegiatan."]);
