<?php

use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use App\Services\FacebookPublishingService;
use App\Services\News\MetaConnections;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config(['services.facebook.page_id' => '12345', 'services.facebook.page_access_token' => 'facebook-private-token', 'services.facebook.graph_version' => 'v26.0']);
    Http::preventStrayRequests();
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    $this->article = ['headline' => 'Berita warga', 'summary' => 'Ringkasan kegiatan.', 'content' => '<p>Kegiatan warga berlangsung dengan lancar hari ini.</p>',
        'content_format' => 'html', 'intent' => 'publish', 'platforms' => ['facebook']];
});

test('Facebook text publication uses feed and saves its ID', function () {
    Http::fake(['graph.facebook.com/*' => Http::response(['id' => '12345_67890'])]);
    $this->postJson('/admin/news/manual', $this->article)->assertOk()->assertJsonPath('results.facebook.success', true);
    expect(IntelligentNewsDraft::sole()->facebook_post_id)->toBe('12345_67890');
    expect(News::count())->toBe(0);
    Http::assertSentCount(1);
    Http::assertSent(fn ($r) => $r->url() === 'https://graph.facebook.com/v26.0/12345/feed'
        && $r['message'] === "Berita warga\n\nRingkasan kegiatan." && $r['access_token'] === 'facebook-private-token');
});

test('Facebook photo publication uses URL and caption and keeps website image', function () {
    Http::fake(['graph.facebook.com/*' => Http::response(['id' => '67890', 'post_id' => '12345_67890'])]);
    $image = 'https://images.example.com/photo.jpg';
    $this->postJson('/admin/news/manual', [...$this->article, 'platforms' => ['website', 'facebook'], 'image' => $image])
        ->assertJsonPath('success', true);
    expect(News::sole()->image)->toBe($image);
    expect(IntelligentNewsDraft::sole()->facebook_post_id)->toBe('12345_67890');
    Http::assertSentCount(1);
    Http::assertSent(fn ($r) => $r->url() === 'https://graph.facebook.com/v26.0/12345/photos'
        && $r['url'] === $image && $r['caption'] === "Berita warga\n\nRingkasan kegiatan.");
});

test('website-only publishing never calls Facebook', function () {
    Http::fake();
    $this->postJson('/admin/news/manual', [...$this->article, 'platforms' => ['website']])->assertJsonPath('success', true);
    Http::assertNothingSent();
});

test('Facebook failure preserves website success and hides provider secrets', function ($body, int $status) {
    Log::spy();
    Log::shouldReceive('channel')->with('single')->andReturnSelf();
    Http::fake(['graph.facebook.com/*' => Http::response($body, $status)]);
    $this->postJson('/admin/news/manual', [...$this->article, 'platforms' => ['website', 'facebook']])
        ->assertJsonPath('results.application.success', true)->assertJsonPath('results.facebook.success', false)
        ->assertDontSee('facebook-private-token');
    expect(News::count())->toBe(1);
    expect(IntelligentNewsDraft::sole()->facebook_post_id)->toBeNull();
    Http::assertSentCount(1);
    Log::shouldHaveReceived('log')->withArgs(fn ($level, $message, $context) => $message === 'manual_publish.facebook.feed.failure'
        && ! str_contains(json_encode($context), 'facebook-private-token'));
})->with([
    [['error' => ['code' => 190, 'message' => 'facebook-private-token']], 400],
    [['error' => ['code' => 200]], 403],
    [[], 200],
    [['id' => ['invalid']], 200],
]);

test('Facebook timeout is not retried and returns uncertain status', function () {
    Http::fake(fn () => throw new ConnectionException('facebook-private-token'));
    $this->postJson('/admin/news/manual', $this->article)->assertJsonPath('results.facebook.success', false)
        ->assertDontSee('facebook-private-token')->assertSee('belum dapat dipastikan');
});

test('successful Facebook publication is not duplicated when another platform is retried', function () {
    config(['services.instagram.user_id' => null]);
    Http::fake(['graph.facebook.com/*' => Http::response(['id' => '12345_67890'])]);
    $payload = [...$this->article, 'platforms' => ['facebook', 'instagram']];
    $this->postJson('/admin/news/manual', $payload)->assertJsonPath('results.facebook.success', true)->assertJsonPath('success', false);
    $draft = IntelligentNewsDraft::sole();
    $this->putJson('/admin/news/manual/'.$draft->id, [...$this->article, 'platforms' => ['facebook', 'website']])->assertJsonPath('success', true);
    Http::assertSentCount(1);
    expect(News::count())->toBe(1);
});

test('configured Facebook is selectable without exposing credentials', function () {
    $platform = app(MetaConnections::class)->platforms(auth()->id())[1];
    expect($platform['status'])->toBe('connected');
    expect(json_encode($platform))->not->toContain('facebook-private-token', '12345');
    config(['services.facebook.page_access_token' => null]);
    expect(app(FacebookPublishingService::class)->configured())->toBeFalse();
    Http::fake();
    $this->post('/admin/news/manual', $this->article)->assertSessionHasErrors('platforms');
    Http::assertNothingSent();
});

test('local Facebook images use Cloudinary without changing original dimensions or storage', function (string $extension) {
    Storage::fake('public');
    config(['filesystems.news_media_disk' => 'public', 'services.cloudinary.cloud_name' => 'demo', 'services.cloudinary.api_key' => 'key', 'services.cloudinary.api_secret' => 'secret']);
    $image = imagecreatetruecolor(600, 300);
    ob_start();
    $extension === 'png' ? imagepng($image) : imagejpeg($image);
    $bytes = ob_get_clean();
    imagedestroy($image);
    $path = 'news-images/facebook.'.$extension;
    Storage::disk('public')->put($path, $bytes);
    Http::fake([
        'api.cloudinary.com/*' => Http::response(['secure_url' => 'https://res.cloudinary.com/demo/image/upload/photo.jpg', 'format' => 'jpg', 'resource_type' => 'image']),
        'graph.facebook.com/*' => Http::response(['id' => '12345_67890']),
    ]);
    $this->postJson('/admin/news/manual', [...$this->article, 'image' => 'http://localhost/storage/'.$path])->assertJsonPath('success', true);
    expect(Storage::disk('public')->get($path))->toBe($bytes);
    Http::assertSentCount(2);
    Http::assertSent(function ($r) {
        if (! str_contains($r->url(), 'api.cloudinary.com')) {
            return false;
        }
        preg_match('/\xFF\xD8.*?\xFF\xD9/s', $r->body(), $matches);
        $size = getimagesizefromstring($matches[0]);

        return $size[0] === 600 && $size[1] === 300;
    });
    Http::assertSent(fn ($r) => str_ends_with($r->url(), '/photos') && $r['url'] === 'https://res.cloudinary.com/demo/image/upload/photo.jpg');
})->with(['png', 'jpg']);

test('Facebook diagnostics record Meta details only in the file log', function (?string $image, string $step) {
    Log::spy();
    Log::shouldReceive('channel')->with('single')->andReturnSelf();
    Http::fake(['graph.facebook.com/*' => Http::response(['error' => [
        'message' => 'Session expired: facebook-private-token', 'type' => 'OAuthException',
        'code' => 190, 'error_subcode' => 463, 'fbtrace_id' => 'trace-for-debugging',
        'access_token' => 'unexpected-token',
    ]], 400)]);
    $this->postJson('/admin/news/manual', [...$this->article, 'image' => $image])
        ->assertJsonPath('results.facebook.success', false)
        ->assertJsonPath('results.facebook.message', 'Token Halaman Facebook tidak valid atau kedaluwarsa. Hubungi administrator.')
        ->assertDontSee('trace-for-debugging')->assertDontSee('Session expired')->assertDontSee('facebook-private-token');
    Log::shouldHaveReceived('channel')->with('single')->once();
    Log::shouldHaveReceived('log')->withArgs(fn ($level, $message, $context) => $level === 'error' && $message === 'manual_publish.facebook.'.$step.'.failure'
        && $context['http_status'] === 400 && $context['error_code'] === 190
        && $context['error_subcode'] === 463 && $context['error_type'] === 'OAuthException'
        && $context['error_message'] === 'Session expired: [REDACTED]'
        && $context['fbtrace_id'] === 'trace-for-debugging'
        && $context['step'] === $step && $context['endpoint'] === 'https://graph.facebook.com/v26.0/12345/'.$step
        && ! str_contains(json_encode($context), 'unexpected-token'));
})->with([[null, 'feed'], ['https://images.example.com/photo.jpg', 'photos']]);
