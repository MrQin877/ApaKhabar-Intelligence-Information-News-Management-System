<?php

use App\Jobs\PublishShortVideo;
use App\Models\ShortVideo;
use App\Models\SocialConnection;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Shorts\CloudinaryVideoService;
use App\Services\Shorts\ReelPublisher;
use App\Services\Shorts\VideoInspector;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

function shortMetadata(): array
{
    return ['format' => 'mov,mp4', 'codec' => 'h264', 'pixel_format' => 'yuv420p', 'width' => 1080, 'height' => 1920, 'duration' => 20, 'fps' => 30, 'bytes' => 1000, 'bitrate' => 5000000, 'audio_codec' => 'aac', 'audio_rate' => 48000, 'audio_channels' => 2, 'field_order' => 'progressive', 'rotation' => 0];
}
function shortUser(string $role = 'admin'): User
{
    return User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => $role])->getKey()]);
}
function shortDraft(User $user): ShortVideo
{
    return ShortVideo::create(['created_by' => $user->getKey(), 'title' => 'Video desa', 'description' => 'Kegiatan warga', 'video_url' => 'https://res.cloudinary.com/demo/video/upload/short.mp4', 'video_public_id' => 'short', 'thumbnail_url' => 'https://res.cloudinary.com/demo/video/upload/so_0/short.jpg', 'metadata' => shortMetadata()]);
}
function shortConnection(User $u, string $platform): SocialConnection
{
    return SocialConnection::create(['user_id' => $u->getKey(), 'platform' => $platform, 'account_id' => '123', 'account_name' => 'Saved account', 'access_token' => 'saved-token', 'auth_source' => 'facebook_login']);
}
function shortPublish($test, ShortVideo $v, array $platforms)
{
    $token = $test->postJson('/admin/short-videos/'.$v->id.'/preview', ['platforms' => $platforms])->assertOk()->json('token');

    return $test->postJson('/admin/short-videos/'.$v->id.'/publish', ['platforms' => $platforms, 'preview_token' => $token]);
}
beforeEach(function () {
    Queue::fake();
    Http::preventStrayRequests();
});

test('admins and moderators access shorts but villagers and guests cannot', function () {
    $this->get('/admin/short-videos')->assertRedirect('/login');
    foreach (['admin', 'moderator'] as $role) {
        $this->actingAs(shortUser($role))->get('/admin/short-videos')->assertOk();
    }
    $this->actingAs(shortUser('villager'))->get('/admin/short-videos')->assertRedirect('/');
});
test('website is mandatory and publication is idempotent with pinned encrypted credentials', function () {
    $u = shortUser();
    $v = shortDraft($u);
    $c = shortConnection($u, 'instagram');
    $this->actingAs($u);
    $this->postJson('/admin/short-videos/'.$v->id.'/preview', ['platforms' => ['instagram']])->assertUnprocessable();
    $platforms = ['website', 'instagram'];
    $token = $this->postJson('/admin/short-videos/'.$v->id.'/preview', ['platforms' => $platforms])->json('token');
    for ($i = 0; $i < 2; $i++) {
        $this->postJson('/admin/short-videos/'.$v->id.'/publish', ['platforms' => $platforms, 'preview_token' => $token])->assertOk()->assertJsonPath('result.results.website.status', 'published');
    }
    expect($v->publications()->count())->toBe(2);
    $p = $v->publications()->where('platform', 'instagram')->first();
    $c->update(['account_id' => '999', 'access_token' => 'new-token']);
    expect($p->fresh()->account_id)->toBe('123')->and($p->credential)->toBe('saved-token')->and($p->getRawOriginal('credential'))->not->toBe('saved-token');
    $this->getJson('/admin/short-videos/'.$v->id.'/status')->assertJsonMissing(['credential' => 'saved-token']);
    Queue::assertPushed(PublishShortVideo::class, 1);
});
test('social connection failure does not roll back website and unselected platforms stay unselected', function () {
    $u = shortUser();
    $v = shortDraft($u);
    $this->actingAs($u);
    shortPublish($this, $v, ['website', 'facebook'])->assertOk()->assertJsonPath('result.results.facebook.status', 'failed')->assertJsonPath('result.results.instagram.status', 'not_selected');
    expect($v->fresh()->status)->toBe('published');
});
test('only published non archived shorts appear on homepage newest first', function () {
    $u = shortUser();
    $a = shortDraft($u);
    $b = shortDraft($u);
    shortDraft($u);
    $a->update(['status' => 'published', 'published_at' => now()->subDay()]);
    $b->update(['status' => 'published', 'published_at' => now()]);
    $this->get('/')->assertInertia(fn (Assert $p) => $p->has('shorts', 2)->where('shorts.0.id', $b->id)->where('shorts.0.video_url', $b->video_url));
    $b->update(['status' => 'archived']);
    $this->get('/')->assertInertia(fn (Assert $p) => $p->has('shorts', 1)->where('shorts.0.id', $a->id));
});
test('ownership and immutable published videos are enforced', function () {
    $u = shortUser();
    $v = shortDraft($u);
    $this->actingAs(shortUser())->getJson('/admin/short-videos/'.$v->id.'/status')->assertForbidden();
    $this->actingAs($u);
    shortPublish($this, $v, ['website'])->assertOk();
    $this->postJson('/admin/short-videos/'.$v->id, ['title' => 'Changed', 'description' => 'Text', 'frame_offset' => 0, 'cover_mode' => 'keep'])->assertUnprocessable();
    $this->postJson('/admin/short-videos/'.$v->id.'/delete')->assertUnprocessable();
});
test('destination video validation rejects bad codec duration and orientation', function () {
    $service = app(VideoInspector::class);
    $service->validate(shortMetadata(), ['website', 'instagram', 'facebook']);
    foreach ([['codec' => 'vp9'], ['duration' => 61], ['width' => 1920, 'height' => 1080], ['fps' => 10]] as $change) {
        expect(fn () => $service->validate(array_replace(shortMetadata(), $change), ['facebook']))->toThrow(ValidationException::class);
    }
    $service->validate(array_replace(shortMetadata(), ['duration' => 300]), ['website', 'instagram']);
});
test('upload uses inspected metadata and Cloudinary urls rather than client metadata', function () {
    $u = shortUser();
    $this->actingAs($u);
    $this->mock(VideoInspector::class)->shouldReceive('inspect')->once()->andReturn(shortMetadata());
    $this->mock(CloudinaryVideoService::class)->shouldReceive('upload')->once()->andReturn(['secure_url' => 'https://res.cloudinary.com/demo/video/upload/test.mp4', 'public_id' => 'test'])->getMock()->shouldReceive('frame')->andReturn('https://res.cloudinary.com/demo/video/upload/so_0/test.jpg');
    $this->postJson('/admin/short-videos/upload', ['video' => UploadedFile::fake()->create('short.mp4', 100, 'video/mp4')])->assertCreated()->assertJsonPath('video.metadata.codec', 'h264');
});
test('instagram waits for processing before publishing and never duplicates saved publication', function () {
    $u = shortUser();
    $v = shortDraft($u);
    shortConnection($u, 'instagram');
    $this->actingAs($u);
    shortPublish($this, $v, ['website', 'instagram']);
    $p = $v->publications()->where('platform', 'instagram')->first();
    $service = app(ReelPublisher::class);
    Http::fake(['*/123/media' => Http::response(['id' => '456']), '*/456*' => Http::sequence()->push(['status_code' => 'IN_PROGRESS'])->push(['status_code' => 'FINISHED']), '*/123/media_publish' => Http::response(['id' => '789']), '*/789*' => Http::response(['permalink' => 'https://www.instagram.com/reel/test/'])]);
    $service->step($p);
    expect($p->fresh()->container_id)->toBe('456');
    $service->step($p->fresh());
    expect($p->fresh()->status)->toBe('processing');
    $service->step($p->fresh());
    expect($p->fresh()->status)->toBe('published')->and($p->fresh()->media_id)->toBe('789');
    $service->step($p->fresh());
    expect($p->fresh()->permalink)->toContain('/reel/');
    (new PublishShortVideo($p->id))->handle($service);
    Http::assertSentCount(5);
});
test('facebook completes start transfer finish and confirms status before success', function () {
    $u = shortUser();
    $v = shortDraft($u);
    shortConnection($u, 'facebook');
    $this->actingAs($u);
    shortPublish($this, $v, ['website', 'facebook']);
    $p = $v->publications()->where('platform', 'facebook')->first();
    $service = app(ReelPublisher::class);
    Http::fake(['*/123/video_reels' => Http::sequence()->push(['video_id' => '456'])->push(['success' => true]), 'https://rupload.facebook.com/*' => Http::response(['success' => true]), '*/456*' => Http::response(['status' => ['publishing_phase' => ['status' => 'complete']]])]);
    for ($i = 0; $i < 3; $i++) {
        $service->step($p->fresh());
    }
    expect($p->fresh()->status)->toBe('processing');
    $service->step($p->fresh());
    expect($p->fresh()->status)->toBe('published')->and($p->fresh()->media_id)->toBe('456');
});
test('uncertain create is never repeated on retry or worker recovery', function () {
    $u = shortUser();
    $v = shortDraft($u);
    shortConnection($u, 'instagram');
    $this->actingAs($u);
    shortPublish($this, $v, ['website', 'instagram']);
    $p = $v->publications()->where('platform', 'instagram')->first();
    Http::fake(['*' => Http::failedConnection()]);
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    expect($p->fresh()->status)->toBe('uncertain');
    $this->postJson('/admin/short-videos/'.$v->id.'/retry/instagram')->assertOk();
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    expect($p->fresh()->status)->toBe('uncertain');
    Http::assertSentCount(1);
});

test('stale previews and invalid covers cannot publish or change a draft', function () {
    $u = shortUser();
    $v = shortDraft($u);
    $this->actingAs($u);
    $token = $this->postJson('/admin/short-videos/'.$v->id.'/preview', ['platforms' => ['website']])->json('token');
    $v->update(['title' => 'Changed']);
    $this->postJson('/admin/short-videos/'.$v->id.'/publish', ['platforms' => ['website'], 'preview_token' => $token])->assertUnprocessable();
    $this->postJson('/admin/short-videos/'.$v->id, ['title' => 'Title', 'description' => 'Description', 'frame_offset' => 21, 'cover_mode' => 'frame'])->assertUnprocessable();
    $this->postJson('/admin/short-videos/'.$v->id, ['title' => 'Title', 'description' => 'Description', 'frame_offset' => 0, 'cover_mode' => 'upload'])->assertUnprocessable();
    expect($v->fresh()->status)->toBe('draft');
});

test('a definite Meta rejection preserves its safe error and can be retried', function () {
    $u = shortUser();
    $v = shortDraft($u);
    shortConnection($u, 'instagram');
    $this->actingAs($u);
    shortPublish($this, $v, ['website', 'instagram']);
    $p = $v->publications()->where('platform', 'instagram')->first();
    Http::fake(['*' => Http::sequence()->push(['error' => ['code' => 190, 'message' => 'secret provider text']], 400)->push(['id' => '456'])]);
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    expect($p->fresh()->status)->toBe('failed')->and($p->fresh()->error_summary)->toContain('190')->not->toContain('secret');
    $this->postJson('/admin/short-videos/'.$v->id.'/retry/instagram')->assertOk();
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    expect($p->fresh()->container_id)->toBe('456');
});

test('a database lease prevents concurrent workers and archived videos stop queued work', function () {
    $u = shortUser();
    $v = shortDraft($u);
    shortConnection($u, 'facebook');
    $this->actingAs($u);
    shortPublish($this, $v, ['website', 'facebook']);
    $p = $v->publications()->where('platform', 'facebook')->first();
    $p->update(['locked_until' => now()->addMinute()]);
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    expect($p->fresh()->attempts)->toBe(0);
    $p->update(['locked_until' => null]);
    $this->postJson('/admin/short-videos/'.$v->id.'/archive')->assertOk();
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    Http::assertNothingSent();
});

test('missing ffprobe fails closed without uploading unvalidated video', function () {
    config(['shorts.ffprobe' => 'definitely-missing-ffprobe-binary']);
    expect(fn () => app(VideoInspector::class)->inspect(UploadedFile::fake()->create('test.mp4', 10, 'video/mp4')))->toThrow(ValidationException::class);
    Http::assertNothingSent();
});

test('Cloudinary video upload uses a signed video endpoint and rejects unsafe URLs', function () {
    config(['services.cloudinary.cloud_name' => 'demo', 'services.cloudinary.api_key' => 'key', 'services.cloudinary.api_secret' => 'secret']);
    Http::fake(['https://api.cloudinary.com/v1_1/demo/video/upload' => Http::response(['resource_type' => 'video', 'format' => 'mp4', 'public_id' => 'apakhabar/shorts/test', 'secure_url' => 'https://res.cloudinary.com/demo/video/upload/test.mp4'])]);
    $asset = app(CloudinaryVideoService::class)->upload(UploadedFile::fake()->create('test.mp4', 10, 'video/mp4'));
    expect($asset['secure_url'])->toStartWith('https://res.cloudinary.com/');
    Http::assertSent(function ($r) {
        $parts = collect($r->data())->keyBy('name');

        return $parts->get('api_key')['contents'] === 'key' && strlen($parts->get('signature')['contents']) === 64;
    });
    expect(fn () => app(CloudinaryVideoService::class)->assertUrl('http://localhost/video.mp4'))->toThrow(RuntimeException::class);
});

test('queued requests use the original target after Settings switches accounts', function () {
    $u = shortUser();
    $v = shortDraft($u);
    $c = shortConnection($u, 'instagram');
    $this->actingAs($u);
    shortPublish($this, $v, ['website', 'instagram']);
    $p = $v->publications()->where('platform', 'instagram')->first();
    $c->update(['account_id' => '999', 'access_token' => 'replacement-token']);
    Http::fake(['*/123/media' => Http::response(['id' => '456'])]);
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    Http::assertSent(fn ($r) => str_ends_with($r->url(), '/123/media') && $r->hasHeader('Authorization', 'Bearer saved-token'));
    expect($p->fresh()->container_id)->toBe('456');
});

test('successful destinations reject retries without making remote requests', function () {
    $u = shortUser();
    $v = shortDraft($u);
    $this->actingAs($u);
    foreach (['instagram', 'facebook'] as $platform) {
        shortConnection($u, $platform);
    }
    shortPublish($this, $v, ['website', 'instagram', 'facebook']);
    foreach (['instagram', 'facebook'] as $platform) {
        $p = $v->publications()->where('platform', $platform)->first();
        $p->update(['status' => 'published', 'stage' => 'done', 'media_id' => '789']);
        $this->postJson('/admin/short-videos/'.$v->id.'/retry/'.$platform)->assertUnprocessable();
        (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    }
    Http::assertNothingSent();
});

test('uncertain final publication is reconciled without a second remote write', function (string $platform) {
    $u = shortUser();
    $v = shortDraft($u);
    shortConnection($u, $platform);
    $this->actingAs($u);
    shortPublish($this, $v, ['website', $platform]);
    $p = $v->publications()->where('platform', $platform)->first();
    $p->update(['container_id' => '456', 'stage' => $platform === 'instagram' ? 'publish_inflight' : 'finish_inflight', 'status' => 'uncertain']);
    Http::fake(['*/456*' => Http::response($platform === 'instagram' ? ['status_code' => 'PUBLISHED'] : ['status' => ['publishing_phase' => ['status' => 'complete']]])]);
    $this->postJson('/admin/short-videos/'.$v->id.'/retry/'.$platform)->assertOk();
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    Http::assertSentCount(1);
    Http::assertSent(fn ($r) => $r->method() === 'GET');
    expect($p->fresh()->status)->toBe($platform === 'instagram' ? 'uncertain' : 'published');
})->with(['instagram', 'facebook']);

test('selected frame and custom cover persist through draft reload and website publication', function () {
    $user = shortUser();
    $video = shortDraft($user);
    $this->actingAs($user);
    $cloud = $this->mock(CloudinaryVideoService::class);
    $cloud->shouldReceive('cover')->once()->with(null, $video->video_public_id, 4.5)->andReturn(['url' => 'https://res.cloudinary.com/demo/video/upload/so_4.500/short.jpg', 'public_id' => null]);
    $this->postJson('/admin/short-videos/'.$video->id, ['title' => 'New title', 'description' => 'Description', 'frame_offset' => 4.5, 'cover_mode' => 'frame'])->assertOk()->assertJsonPath('video.frame_offset', 4.5);
    $this->get('/admin/short-videos')->assertInertia(fn (Assert $page) => $page->where('videos.data.0.frame_offset', 4.5)->where('videos.data.0.thumbnail_url', 'https://res.cloudinary.com/demo/video/upload/so_4.500/short.jpg'));
    $cloud->shouldReceive('cover')->once()->with(Mockery::type(UploadedFile::class), $video->video_public_id, 4.5)->andReturn(['url' => 'https://res.cloudinary.com/demo/image/upload/cover.jpg', 'public_id' => null]);
    $this->postJson('/admin/short-videos/'.$video->id, ['title' => 'New title', 'description' => 'Description', 'frame_offset' => 4.5, 'cover_mode' => 'upload', 'cover' => UploadedFile::fake()->image('cover.jpg')])->assertOk();
    shortPublish($this, $video->fresh(), ['website'])->assertOk();
    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('shorts.0.thumbnail_url', 'https://res.cloudinary.com/demo/image/upload/cover.jpg'));
});
