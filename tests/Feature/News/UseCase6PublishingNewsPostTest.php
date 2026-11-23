<?php

use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\NewsCategory;
use App\Models\ShortVideo;
use App\Models\SocialConnection;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Shorts\ReelPublisher;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

beforeEach(function () {
    Queue::fake();
    Http::preventStrayRequests();
    Storage::fake('public');
    config([
        'filesystems.news_media_disk' => 'public',
        'services.cloudinary.cloud_name' => 'demo',
        'services.facebook.page_id' => null, 'services.facebook.page_access_token' => null,
        'services.instagram.user_id' => null, 'services.instagram.access_token' => null,
        'meta.facebook.app_id' => 'uc6-app', 'meta.facebook.app_secret' => 'uc6-app-secret',
        'meta.facebook.redirect_uri' => 'http://localhost:8000/admin/social/facebook/callback',
        'meta.login_config_ids.facebook' => null, 'meta.login_config_ids.instagram' => null,
        'meta.graph_version' => 'v25.0', 'meta.instagram_discovery_diagnostics' => false,
    ]);
    $this->withCredentials();
    $this->withCookie(config('session.cookie'), Str::random(40));
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    $category = NewsCategory::firstOrCreate(['name' => 'Pengumuman'], ['slug' => 'pengumuman', 'is_active' => true]);
    $this->uc6Article = [
        'headline' => 'Community programme update', 'category_id' => $category->getKey(),
        'content' => '<p>The community programme was held at the village hall.</p>',
        'content_format' => 'html', 'intent' => 'publish', 'platforms' => ['website'],
    ];
});

function uc6VideoDraft(): ShortVideo
{
    return ShortVideo::create([
        'created_by' => auth()->id(), 'title' => 'Community programme video', 'description' => 'The team recorded the community programme.',
        'video_url' => 'https://res.cloudinary.com/demo/video/upload/short.mp4', 'video_public_id' => 'short',
        'thumbnail_url' => 'https://res.cloudinary.com/demo/video/upload/so_0/short.jpg',
        'metadata' => ['format' => 'mov,mp4', 'codec' => 'h264', 'pixel_format' => 'yuv420p', 'width' => 1080,
            'height' => 1920, 'duration' => 20, 'fps' => 30, 'bytes' => 1000, 'bitrate' => 5000000,
            'audio_codec' => 'aac', 'audio_rate' => 48000, 'audio_channels' => 2, 'field_order' => 'progressive', 'rotation' => 0],
    ]);
}

function uc6PublishVideo($test, ShortVideo $video, array $platforms)
{
    $token = $test->postJson('/admin/short-videos/'.$video->id.'/preview', ['platforms' => $platforms])
        ->assertOk()->json('token');

    return $test->postJson('/admin/short-videos/'.$video->id.'/publish', ['platforms' => $platforms, 'preview_token' => $token]);
}

function uc6VideoConnection(string $platform): void
{
    SocialConnection::create([
        'user_id' => auth()->id(), 'platform' => $platform, 'account_id' => '123',
        'account_name' => 'Community account', 'access_token' => 'uc6-video-token', 'auth_source' => 'facebook_login',
    ]);
}

test('TC-UC6-01 connects a Facebook page after OAuth and explicit selection', function () {
    Http::fake([
        '*debug_token*' => Http::response(['data' => ['is_valid' => true, 'app_id' => 'uc6-app', 'type' => 'PAGE', 'profile_id' => '123', 'expires_at' => 0, 'scopes' => ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']]]),
        '*oauth/access_token*' => Http::response(['access_token' => 'uc6-user-token', 'expires_in' => 5000]),
        '*me/accounts*' => Http::response(['data' => [['id' => '123', 'name' => 'Community Page', 'access_token' => 'uc6-page-token', 'tasks' => ['CREATE_CONTENT']]]]),
    ]);
    $response = $this->get('/admin/social/facebook/connect')->assertRedirect();
    parse_str(parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);
    $this->get('/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'code' => 'uc6-code']))
        ->assertRedirect('/settings/integration');
    expect(SocialConnection::count())->toBe(0);
    $this->postJson('/admin/social/facebook/page', ['ticket' => session('meta_selection'), 'page_id' => '123'])
        ->assertOk()->assertJsonPath('platforms.1.status', 'connected')->assertDontSee('uc6-page-token');
    $connection = SocialConnection::sole();
    expect($connection->access_token)->toBe('uc6-page-token')
        ->and($connection->getRawOriginal('access_token'))->not->toBe('uc6-page-token');
});

test('TC-UC6-02 connects a linked Instagram account using Meta OAuth', function () {
    Http::fake([
        '*debug_token*' => Http::response(['data' => ['is_valid' => true, 'app_id' => 'uc6-app', 'type' => 'PAGE', 'profile_id' => '456', 'expires_at' => 0, 'scopes' => ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish']]]),
        '*oauth/access_token*' => Http::response(['access_token' => 'uc6-user-token', 'expires_in' => 5000]),
        '*me/accounts*' => Http::response(['data' => [['id' => '456', 'name' => 'Linked Page', 'access_token' => 'uc6-instagram-token', 'tasks' => ['CREATE_CONTENT'], 'instagram_business_account' => ['id' => '789', 'username' => 'community']]]]),
    ]);
    $response = $this->get('/admin/social/instagram/connect')->assertRedirect();
    parse_str(parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);
    $this->get('/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'code' => 'uc6-code']))
        ->assertRedirect('/settings/integration');
    $this->postJson('/admin/social/meta/account', ['ticket' => session('meta_selection'), 'page_id' => '456'])
        ->assertOk()->assertJsonPath('platforms.2.status', 'connected')->assertDontSee('uc6-instagram-token');
    $connection = SocialConnection::sole();
    expect($connection->platform)->toBe('instagram')->and($connection->account_id)->toBe('789')
        ->and($connection->getRawOriginal('access_token'))->not->toBe('uc6-instagram-token');
});

test('TC-UC6-03 publishes a new article to the application', function () {
    Http::fake();
    $this->postJson('/admin/news/manual', $this->uc6Article)->assertOk()
        ->assertJsonPath('success', true)->assertJsonPath('results.application.success', true);
    expect(News::sole()->title)->toBe($this->uc6Article['headline'])
        ->and(IntelligentNewsDraft::sole()->status)->toBe('published');
    Http::assertNothingSent();
});

test('TC-UC6-04 publishes the latest content from a saved draft', function () {
    Http::fake();
    $this->postJson('/admin/news/manual', [...$this->uc6Article, 'intent' => 'draft'])->assertOk();
    $draft = IntelligentNewsDraft::sole();
    expect(News::count())->toBe(0);
    $this->putJson('/admin/news/manual/'.$draft->id, [...$this->uc6Article, 'headline' => 'Final published headline'])
        ->assertOk()->assertJsonPath('results.application.success', true);
    expect(News::sole()->title)->toBe('Final published headline')
        ->and($draft->fresh()->status)->toBe('published')->and(IntelligentNewsDraft::count())->toBe(1);
});

test('TC-UC6-05 publishes a Facebook post and stores its post ID', function () {
    config(['services.facebook.page_id' => '123', 'services.facebook.page_access_token' => 'uc6-page-token']);
    Http::fake(['graph.facebook.com/*' => Http::response(['id' => '123_456'])]);
    $this->postJson('/admin/news/manual', [...$this->uc6Article, 'platforms' => ['facebook']])
        ->assertOk()->assertJsonPath('results.facebook.success', true);
    expect(IntelligentNewsDraft::sole()->facebook_post_id)->toBe('123_456')->and(News::count())->toBe(0);
    Http::assertSentCount(1);
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/123/feed') && str_contains($request['message'], $this->uc6Article['headline']));
});

test('TC-UC6-06 publishes an Instagram image and stores its media ID', function () {
    config([
        'services.instagram.user_id' => '789', 'services.instagram.access_token' => 'uc6-instagram-token',
        'services.cloudinary.cloud_name' => 'demo', 'services.cloudinary.api_key' => 'uc6-key', 'services.cloudinary.api_secret' => 'uc6-secret',
        'services.instagram.public_base_url' => 'https://public.example.com',
    ]);
    $image = imagecreatetruecolor(1080, 1080);
    ob_start();
    imagejpeg($image);
    $jpeg = ob_get_clean();
    imagedestroy($image);
    Http::fake([
        'https://images.example.com/*' => Http::response($jpeg, 200, ['Content-Type' => 'image/jpeg']),
        'api.cloudinary.com/*' => Http::response(['resource_type' => 'image', 'format' => 'jpg', 'secure_url' => 'https://res.cloudinary.com/demo/image/upload/news.jpg']),
        'https://res.cloudinary.com/*' => Http::response($jpeg, 200, ['Content-Type' => 'image/jpeg']),
        'https://graph.instagram.com/*' => Http::sequence()->push(['id' => '111'])->push(['id' => '222']),
    ]);
    $this->postJson('/admin/news/manual', [...$this->uc6Article, 'platforms' => ['instagram'], 'image' => 'https://images.example.com/news.jpg'])
        ->assertOk()->assertJsonPath('results.instagram.success', true);
    expect(IntelligentNewsDraft::sole()->instagram_media_id)->toBe('222')->and(News::count())->toBe(0);
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/789/media_publish') && $request['creation_id'] === '111');
});

test('TC-UC6-07 publishes a saved draft to Facebook and the application', function () {
    config(['services.facebook.page_id' => '123', 'services.facebook.page_access_token' => 'uc6-page-token']);
    Http::fake(['graph.facebook.com/*' => Http::response(['id' => '123_456'])]);
    $this->postJson('/admin/news/manual', [...$this->uc6Article, 'intent' => 'draft'])->assertOk();
    $draft = IntelligentNewsDraft::sole();
    Http::assertNothingSent();
    $this->putJson('/admin/news/manual/'.$draft->id, [...$this->uc6Article, 'platforms' => ['website', 'facebook']])
        ->assertOk()->assertJsonPath('results.application.success', true)->assertJsonPath('results.facebook.success', true);
    expect(News::count())->toBe(1)->and($draft->fresh()->facebook_post_id)->toBe('123_456');
});

test('TC-UC6-08 rejects an invalid OAuth state without connecting an account', function () {
    Http::fake();
    $this->get('/admin/social/facebook/callback?state=invalid&code=unused')->assertStatus(419);
    expect(SocialConnection::count())->toBe(0);
    Http::assertNothingSent();
});

test('TC-UC6-09 rejects publication to a disconnected Facebook account', function () {
    Http::fake();
    $this->postJson('/admin/news/manual', [...$this->uc6Article, 'platforms' => ['facebook']])
        ->assertUnprocessable()->assertJsonValidationErrors('platforms');
    expect(News::count())->toBe(0)->and(IntelligentNewsDraft::count())->toBe(0);
    Http::assertNothingSent();
});

test('TC-UC6-10 preserves application success when Meta rejects an expired token', function () {
    config(['services.facebook.page_id' => '123', 'services.facebook.page_access_token' => 'uc6-page-token']);
    Http::fake(['graph.facebook.com/*' => Http::response(['error' => ['code' => 190, 'message' => 'uc6-page-token expired']], 400)]);
    $this->postJson('/admin/news/manual', [...$this->uc6Article, 'platforms' => ['website', 'facebook']])
        ->assertOk()->assertJsonPath('success', false)->assertJsonPath('results.application.success', true)
        ->assertJsonPath('results.facebook.success', false)->assertDontSee('uc6-page-token');
    expect(News::count())->toBe(1)->and(IntelligentNewsDraft::sole()->facebook_post_id)->toBeNull();
});

test('TC-UC6-11 rejects publication when required content is missing', function () {
    Http::fake();
    $this->postJson('/admin/news/manual', [...$this->uc6Article, 'headline' => '', 'content' => ''])
        ->assertUnprocessable()->assertJsonValidationErrors(['headline', 'content']);
    expect(News::count())->toBe(0);
    Http::assertNothingSent();
});

test('TC-UC6-12 prevents a duplicate publication of an already published draft', function () {
    Http::fake();
    $this->postJson('/admin/news/manual', $this->uc6Article)->assertOk();
    $draft = IntelligentNewsDraft::sole();
    $this->postJson('/admin/news/drafts/'.$draft->id.'/publish', ['platforms' => ['website']])->assertUnprocessable();
    expect(News::count())->toBe(1)->and(IntelligentNewsDraft::count())->toBe(1);
    Http::assertNothingSent();
});

test('TC-UC6-13 publishes a saved video draft to the application', function () {
    Http::fake();
    $video = uc6VideoDraft();
    $this->postJson('/admin/short-videos/'.$video->id, [
        'title' => 'Final programme video', 'description' => $video->description, 'frame_offset' => 0, 'cover_mode' => 'keep',
    ])->assertOk();
    uc6PublishVideo($this, $video->fresh(), ['website'])->assertOk()->assertJsonPath('result.results.website.status', 'published');
    expect($video->fresh()->status)->toBe('published')->and($video->fresh()->title)->toBe('Final programme video');
    $this->get('/shorts/'.$video->id)->assertOk();
    Http::assertNothingSent();
});

test('TC-UC6-14 publishes a saved video draft as an Instagram reel', function () {
    uc6VideoConnection('instagram');
    $video = uc6VideoDraft();
    uc6PublishVideo($this, $video, ['website', 'instagram'])->assertOk();
    Http::fake([
        '*/123/media' => Http::response(['id' => '456']),
        '*/456*' => Http::response(['status_code' => 'FINISHED']),
        '*/123/media_publish' => Http::response(['id' => '789']),
    ]);
    $publication = $video->publications()->where('platform', 'instagram')->firstOrFail();
    $publisher = app(ReelPublisher::class);
    $publisher->step($publication);
    $publisher->step($publication->fresh());
    expect($publication->fresh()->status)->toBe('published')->and($publication->fresh()->media_id)->toBe('789');
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/123/media')
        && $request['media_type'] === 'REELS' && $request['video_url'] === $video->video_url);
});

test('TC-UC6-15 publishes a saved video draft as a Facebook reel', function () {
    uc6VideoConnection('facebook');
    $video = uc6VideoDraft();
    uc6PublishVideo($this, $video, ['website', 'facebook'])->assertOk();
    Http::fake([
        '*/123/video_reels' => Http::sequence()->push(['video_id' => '567'])->push(['success' => true]),
        'https://rupload.facebook.com/*' => Http::response(['success' => true]),
        '*/567*' => Http::response(['status' => ['publishing_phase' => ['status' => 'complete']]]),
    ]);
    $publication = $video->publications()->where('platform', 'facebook')->firstOrFail();
    $publisher = app(ReelPublisher::class);
    for ($i = 0; $i < 4; $i++) {
        $publisher->step($publication->fresh());
    }
    expect($publication->fresh()->status)->toBe('published')->and($publication->fresh()->media_id)->toBe('567');
    Http::assertSent(fn ($request) => str_contains($request->url(), 'rupload.facebook.com') && $request->hasHeader('file_url', $video->video_url));
});

test('TC-UC6-16 repeated video publication does not duplicate records', function () {
    Http::fake();
    $video = uc6VideoDraft();
    uc6PublishVideo($this, $video, ['website'])->assertOk();
    uc6PublishVideo($this, $video->fresh(), ['website'])->assertOk();
    expect($video->publications()->where('platform', 'website')->count())->toBe(1)->and(ShortVideo::count())->toBe(1);
    Http::assertNothingSent();
});

test('TC-UC6-17 rejects a stale video preview after draft changes', function () {
    $video = uc6VideoDraft();
    $token = $this->postJson('/admin/short-videos/'.$video->id.'/preview', ['platforms' => ['website']])->assertOk()->json('token');
    $video->update(['title' => 'Changed after preview']);
    $this->postJson('/admin/short-videos/'.$video->id.'/publish', ['platforms' => ['website'], 'preview_token' => $token])->assertUnprocessable();
    expect($video->fresh()->status)->toBe('draft')->and($video->publications()->count())->toBe(0);
});

test('TC-UC6-18 blocks video publication while processing is pending', function () {
    $video = uc6VideoDraft();
    $video->update(['metadata' => [...$video->metadata, 'processing' => ['status' => 'queued', 'revision' => 'pending-revision']]]);
    $this->postJson('/admin/short-videos/'.$video->id.'/preview', ['platforms' => ['website']])->assertUnprocessable();
    $this->postJson('/admin/short-videos/'.$video->id.'/publish', ['platforms' => ['website'], 'preview_token' => 'unused'])->assertUnprocessable();
    expect($video->fresh()->status)->toBe('draft')->and($video->publications()->count())->toBe(0);
});

test('TC-UC6-19 video social connection failure preserves application publication', function () {
    Http::fake();
    $video = uc6VideoDraft();
    uc6PublishVideo($this, $video, ['website', 'facebook'])->assertOk()
        ->assertJsonPath('result.results.website.status', 'published')
        ->assertJsonPath('result.results.facebook.status', 'failed');
    expect($video->fresh()->status)->toBe('published');
    Http::assertNothingSent();
});
