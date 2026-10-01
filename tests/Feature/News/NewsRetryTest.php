<?php

use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\SocialConnection;
use App\Models\User;
use App\Models\UserRole;
use App\Services\FacebookPublishingService;
use App\Services\InstagramService;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    foreach (['facebook', 'instagram'] as $platform) {
        SocialConnection::create(['user_id' => auth()->id(), 'platform' => $platform, 'account_id' => '123',
            'account_name' => 'Test account', 'access_token' => 'private', 'auth_source' => 'facebook_login']);
    }
    Http::preventStrayRequests();
    $this->article = ['headline' => 'Berita kegiatan warga',
        'content' => '<p>Warga mengadakan kegiatan bersama di desa hari ini.</p>', 'content_format' => 'html',
        'intent' => 'publish', 'platforms' => ['website', 'facebook', 'instagram']];
});

test('retry publishes only failed Instagram and keeps the same website news and Facebook post', function () {
    $facebook = $this->mock(FacebookPublishingService::class);
    $facebook->shouldReceive('configured')->andReturn(true);
    $facebook->shouldReceive('publish')->once()->andReturn('fb-post');
    $instagram = $this->mock(InstagramService::class);
    $instagram->shouldReceive('publish')->once()->andThrow(ValidationException::withMessages(['platforms' => 'Gagal Instagram']));
    $this->postJson('/admin/news/manual', $this->article)->assertOk()->assertJsonPath('success', false);
    $draft = IntelligentNewsDraft::sole();
    $newsId = News::sole()->getKey();
    expect($draft->publicationResults()['instagram']['success'])->toBeFalse();
    $this->get('/admin/news')->assertInertia(fn (Assert $page) => $page->has('items', 1)
        ->where('items.0.record_type', 'news')->where('items.0.publication_results.facebook.success', true)
        ->where('items.0.publication_results.instagram.success', false)
        ->where('items.0.retry_url', route('admin.news-workspace.drafts.retry', $draft)));
    $this->mock(InstagramService::class)->shouldReceive('publish')->once()->andReturn('ig-post');
    $this->postJson('/admin/news/drafts/'.$draft->id.'/retry', ['platforms' => ['instagram']])
        ->assertOk()->assertJsonPath('success', true)->assertJsonMissingPath('results.facebook');
    expect(News::count())->toBe(1)->and(News::sole()->getKey())->toBe($newsId)
        ->and(IntelligentNewsDraft::count())->toBe(1)->and($draft->fresh()->instagram_media_id)->toBe('ig-post')
        ->and($draft->fresh()->facebook_post_id)->toBe('fb-post');
    $this->get('/admin/news')->assertInertia(fn (Assert $page) => $page->has('items', 1)
        ->where('items.0.publication_results.instagram.success', true)->where('items.0.retry_url', null));
    $this->postJson('/admin/news/drafts/'.$draft->id.'/retry', ['platforms' => ['instagram']])->assertUnprocessable();
});

test('retry refuses successful unselected disconnected and other users platforms', function () {
    $this->mock(InstagramService::class)->shouldReceive('publish')->once()
        ->andThrow(ValidationException::withMessages(['platforms' => 'Gagal']));
    $this->postJson('/admin/news/manual', [...$this->article, 'platforms' => ['website', 'instagram']])->assertOk();
    $draft = IntelligentNewsDraft::sole();
    $url = '/admin/news/drafts/'.$draft->id.'/retry';
    $this->mock(FacebookPublishingService::class)->shouldReceive('configured')->andReturn(true);
    foreach (['website', 'facebook'] as $platform) {
        $this->postJson($url, ['platforms' => [$platform]])->assertUnprocessable();
    }
    SocialConnection::where('platform', 'instagram')->update(['invalidated_at' => now()]);
    $this->postJson($url, ['platforms' => ['instagram']])->assertUnprocessable();
    $this->actingAs(User::factory()->create(['roleID' => UserRole::where('name', 'admin')->value('roleID')]));
    $this->postJson($url, ['platforms' => ['instagram']])->assertForbidden();
    expect($draft->fresh()->publicationResults()['instagram']['success'])->toBeFalse()->and(News::count())->toBe(1);
});

test('subset retry retains other failures and multiple failures can be retried together', function () {
    $facebook = $this->mock(FacebookPublishingService::class);
    $facebook->shouldReceive('configured')->andReturn(true);
    $facebook->shouldReceive('publish')->once()->andThrow(ValidationException::withMessages(['platforms' => 'Gagal']));
    $this->mock(InstagramService::class)->shouldReceive('publish')->twice()->andThrow(ValidationException::withMessages(['platforms' => 'Gagal']));
    $this->postJson('/admin/news/manual', $this->article)->assertOk();
    $draft = IntelligentNewsDraft::sole();
    $url = '/admin/news/drafts/'.$draft->id.'/retry';
    $this->postJson($url, ['platforms' => ['instagram']])->assertOk()->assertJsonPath('success', false);
    expect($draft->fresh()->publicationResults()['facebook']['success'])->toBeFalse();
    $facebook = $this->mock(FacebookPublishingService::class);
    $facebook->shouldReceive('configured')->andReturn(true);
    $facebook->shouldReceive('publish')->once()->andReturn('fb-post');
    $this->mock(InstagramService::class)->shouldReceive('publish')->once()->andReturn('ig-post');
    $this->postJson($url, ['platforms' => ['facebook', 'instagram']])->assertOk()->assertJsonPath('success', true);
    expect(News::count())->toBe(1);
});

test('social only publication stays visible and website retry creates only one website record', function () {
    $this->mock(InstagramService::class)->shouldReceive('publish')->once()->andReturn('ig-post');
    News::creating(fn () => throw new RuntimeException('Website failure'));
    try {
        $this->postJson('/admin/news/manual', [...$this->article, 'platforms' => ['website', 'instagram']])->assertOk();
    } finally {
        News::flushEventListeners();
    }
    $draft = IntelligentNewsDraft::sole();
    $this->get('/admin/news')->assertInertia(fn (Assert $page) => $page->has('items', 1)
        ->where('items.0.status', 'active')->where('items.0.view_url', null));
    $this->postJson('/admin/news/drafts/'.$draft->id.'/retry', ['platforms' => ['website']])->assertOk()->assertJsonPath('success', true);
    expect(News::count())->toBe(1)->and($draft->fresh()->instagram_media_id)->toBe('ig-post');
    $this->get('/admin/news')->assertInertia(fn (Assert $page) => $page->has('items', 1)->where('items.0.record_type', 'news'));
});
