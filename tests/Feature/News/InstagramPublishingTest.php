<?php

use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use App\Services\InstagramService;
use App\Services\News\MetaConnections;
use App\Support\PublishLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    config(['services.instagram.user_id' => '12345', 'services.instagram.access_token' => 'server-secret']);
    config(['services.instagram.public_base_url' => 'https://public.example.com']);
    Http::preventStrayRequests();
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    $this->article = [
        'headline' => 'Kegiatan warga', 'summary' => 'Ringkasan kegiatan warga.',
        'content' => '<p>Kegiatan warga berlangsung dengan lancar hari ini.</p>',
        'content_format' => 'html', 'intent' => 'publish',
        'image' => 'https://images.example.com/news.jpg', 'platforms' => ['instagram'],
    ];
});

test('manual Instagram publishing uses two server-side calls and respects platform selection', function (array $platforms, int $websiteCount) {
    Http::fakeSequence()->push(['id' => '111'])->push(['id' => '222']);
    $this->post('/admin/news/manual', [...$this->article, 'platforms' => $platforms])->assertSessionHasNoErrors()->assertRedirect('/admin/news');
    expect(News::count())->toBe($websiteCount);
    expect(IntelligentNewsDraft::sole()->status)->toBe('published');
    Http::assertSentCount(2);
    Http::assertSent(fn ($r) => str_ends_with($r->url(), '/12345/media') && $r['image_url'] === $this->article['image'] && $r['caption'] === "Kegiatan warga\n\nRingkasan kegiatan warga." && $r['access_token'] === 'server-secret');
    Http::assertSent(fn ($r) => str_ends_with($r->url(), '/12345/media_publish') && $r['creation_id'] === '111');
})->with([[['instagram'], 0], [['website', 'instagram'], 1]]);

test('Instagram errors preserve successful website publication', function (bool $creationSucceeds, array $failure, int $status) {
    $sequence = Http::fakeSequence();
    if ($creationSucceeds) {
        $sequence->push(['id' => '111']);
    }
    $sequence->push($failure, $status);
    $this->post('/admin/news/manual', [...$this->article, 'platforms' => ['website', 'instagram']])
        ->assertSessionHas('publishResult.success', false)
        ->assertSessionHas('publishResult.results.application.success', true)
        ->assertSessionHas('publishResult.results.instagram.success', false);
    expect(News::count())->toBe(1);
    expect(IntelligentNewsDraft::sole()->status)->toBe('draft');
    Http::assertSentCount($creationSucceeds ? 2 : 1);
})->with([
    [false, ['error' => ['code' => 190]], 400],
    [false, ['error' => ['code' => 100]], 400],
    [false, [], 200],
    [true, ['error' => ['code' => 100]], 400],
    [true, [], 200],
]);

test('Instagram rejects local media without calling Meta', function (string $url) {
    Http::fake();
    expect(fn () => app(InstagramService::class)->publish($url, 'News caption'))
        ->toThrow(ValidationException::class);
    Http::assertNothingSent();
})->with(['/storage/a.jpg', 'file:///tmp/a.jpg']);

test('Instagram converts local image origins and preserves the path', function (string $origin) {
    Http::fakeSequence()->push(['id' => '111'])->push(['id' => '222']);
    $this->post('/admin/news/manual', [...$this->article, 'image' => $origin.'/storage/news-images/cover.jpg?v=1'])
        ->assertSessionHasNoErrors();
    Http::assertSent(fn ($r) => str_ends_with($r->url(), '/media')
        && $r['image_url'] === 'https://public.example.com/storage/news-images/cover.jpg?v=1');
})->with(['http://192.168.68.59:8000', 'http://localhost:8000', 'http://127.0.0.1:8000', 'http://10.0.0.2', 'http://[::1]:8000']);

test('Instagram converts PNG uploads to a separate public JPEG and preserves the original', function () {
    Storage::fake('public');
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=');
    Storage::disk('public')->put('news-images/original.png', $png);
    Http::fakeSequence()->push(['id' => '111'])->push(['id' => '222']);

    $id = app(InstagramService::class)->publish(
        'https://app.example.com/storage/news-images/original.png', 'News caption',
    );

    expect($id)->toBe('222');
    expect(Storage::disk('public')->get('news-images/original.png'))->toBe($png);
    $jpegPaths = collect(Storage::disk('public')->allFiles('news-images/instagram'));
    expect($jpegPaths)->toHaveCount(1);
    expect($jpegPaths->first())->toEndWith('.jpg');
    expect(getimagesizefromstring(Storage::disk('public')->get($jpegPaths->first()))['mime'])->toBe('image/jpeg');
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/media')
        && $request['image_url'] === 'https://public.example.com/storage/'.$jpegPaths->first());
});

test('Instagram passes JPEG images through without creating a copy', function () {
    Storage::fake('public');
    Http::fakeSequence()->push(['id' => '111'])->push(['id' => '222']);

    app(InstagramService::class)->publish('https://images.example.com/news.jpeg', 'News caption');

    expect(Storage::disk('public')->allFiles('news-images'))->toBe([]);
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/media')
        && $request['image_url'] === 'https://images.example.com/news.jpeg');
});

test('Instagram reports failed PNG conversion without contacting Meta', function () {
    Storage::fake('public');
    Storage::disk('public')->put('news-images/broken.png', 'not a valid PNG');
    Http::fake();

    expect(fn () => app(InstagramService::class)->publish(
        'https://app.example.com/storage/news-images/broken.png', 'News caption',
    ))->toThrow(ValidationException::class);

    Http::assertNothingSent();
    Storage::disk('public')->assertMissing('news-images/instagram');
});

test('missing or private public base prevents readiness and publishing', function (?string $base) {
    config(['services.instagram.public_base_url' => $base]);
    Http::fake();
    expect(app(InstagramService::class)->configured())->toBeFalse();
    expect(app(MetaConnections::class)->platforms(auth()->id())[2]['status'])->toBe('disconnected');
    $this->post('/admin/news/manual', $this->article)->assertSessionHas('publishResult.results.instagram.success', false);
    Http::assertNothingSent();
})->with([null, '', 'http://localhost:8000', 'http://192.168.1.10:8000']);

test('converted URLs are validated again', function () {
    config(['services.instagram.public_base_url' => 'http://192.168.1.10']);
    expect(fn () => app(InstagramService::class)->publicImageUrl('http://localhost/storage/a.jpg'))
        ->toThrow(ValidationException::class);
});

test('missing Instagram credentials and Facebook selections are rejected', function () {
    Http::fake();
    config(['services.instagram.user_id' => null]);
    $this->post('/admin/news/manual', $this->article)->assertSessionHas('publishResult.results.instagram.success', false);
    $this->post('/admin/news/manual', [...$this->article, 'platforms' => ['facebook']])->assertSessionHasErrors('platforms');
    Http::assertNothingSent();
});

test('Instagram timeout is a friendly error without leaking credentials', function () {
    Http::fake(fn () => throw new ConnectionException('server-secret'));
    $this->postJson('/admin/news/manual', $this->article)->assertOk()
        ->assertJsonPath('results.instagram.success', false)->assertDontSee('server-secret');
});

test('platform metadata never exposes Instagram credentials', function () {
    $platforms = app(MetaConnections::class)->platforms(auth()->id());
    expect($platforms[2]['status'])->toBe('connected');
    expect(json_encode($platforms))->not->toContain('server-secret', '12345');
});

test('retrying a partial publication does not duplicate website news', function () {
    Http::fakeSequence()->push(['error' => ['code' => 190]], 400)->push(['id' => '111'])->push(['id' => '222']);
    $payload = [...$this->article, 'platforms' => ['website', 'instagram']];
    $this->post('/admin/news/manual', $payload)->assertSessionHas('publishResult.results.application.success', true);
    $draft = IntelligentNewsDraft::sole();
    $this->put('/admin/news/manual/'.$draft->id, $payload)->assertSessionHas('publishResult.success', true);
    expect(News::count())->toBe(1);
    expect($draft->fresh()->instagram_media_id)->toBe('222');
    Http::assertSentCount(3);
});

test('website failure does not prevent Instagram and technical errors stay out of response', function () {
    Http::fakeSequence()->push(['id' => '111'])->push(['id' => '222']);
    News::creating(fn () => throw new RuntimeException('database technical failure server-secret'));
    try {
        $this->postJson('/admin/news/manual', [...$this->article, 'platforms' => ['website', 'instagram']])
            ->assertOk()->assertJsonPath('success', false)
            ->assertJsonPath('results.application.success', false)
            ->assertJsonPath('results.instagram.success', true)
            ->assertDontSee('database technical failure')->assertDontSee('server-secret');
    } finally {
        News::flushEventListeners();
    }
    expect(News::count())->toBe(0);
    expect(IntelligentNewsDraft::sole()->instagram_media_id)->toBe('222');
});

test('publish stage logs redact credentials in Meta bodies and exception messages', function () {
    $records = [];
    Log::shouldReceive('log')->andReturnUsing(function ($level, $message, $context) use (&$records) {
        $records[] = [$level, $message, $context];
    });
    PublishLog::write('test', ['response_body' => ['access_token' => 'another-secret', 'error' => ['message' => 'server-secret']],
        'exception_message' => 'Authorization: Bearer another-secret', 'image_url' => 'https://example.com/a.jpg?signature=hidden']);
    $encoded = json_encode($records);
    expect($encoded)->not->toContain('server-secret', 'another-secret', 'signature=hidden')->toContain('REDACTED');
});
