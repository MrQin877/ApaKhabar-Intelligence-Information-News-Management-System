<?php

use App\Jobs\PublishShortVideo;
use App\Models\ShortVideo;
use App\Models\SocialConnection;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Shorts\CloudinaryVideoService;
use App\Services\Shorts\PublicationPermalink;
use App\Services\Shorts\ReelCaption;
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

test('facebook permalink reads preserve returned relative path and wait for delayed metadata without reposting', function () {
    $user = shortUser();
    $video = shortDraft($user);
    $video->update(['status' => 'published']);
    $p = $video->publications()->create(['platform' => 'facebook', 'status' => 'published', 'stage' => 'permalink', 'media_id' => '123', 'account_id' => '456', 'graph_host' => 'graph.facebook.com', 'graph_version' => 'v26.0', 'credential' => 'original-page-token']);
    Http::fakeSequence()->push(['id' => '123'])->push(['id' => '123', 'permalink_url' => '/reel/actual-provider-path/']);
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    expect($p->fresh()->status)->toBe('published');
    expect($p->fresh()->stage)->toBe('permalink');
    Queue::assertPushed(PublishShortVideo::class);
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    expect($p->fresh()->permalink)->toBe('https://www.facebook.com/reel/actual-provider-path/');
    expect($p->fresh()->stage)->toBe('done');
    Http::assertSent(fn ($request) => $request->method() === 'GET' && str_contains($request->url(), '/v26.0/123') && $request['fields'] === 'permalink_url' && $request->hasHeader('Authorization', 'Bearer original-page-token'));
    Http::assertNotSent(fn ($request) => $request->method() !== 'GET');
    $this->actingAs($user)->get('/admin/short-videos')->assertInertia(fn (Assert $page) => $page->where('videos.data.0.publications.0.permalink', 'https://www.facebook.com/reel/actual-provider-path/'));
});

test('missing permalink lookup is bounded and expired credentials never change successful publication status', function () {
    $video = shortDraft(shortUser());
    $video->update(['status' => 'published']);
    $p = $video->publications()->create(['platform' => 'facebook', 'status' => 'published', 'stage' => 'permalink', 'media_id' => '123', 'credential' => 'token', 'credential_expires_at' => now()->subMinute(), 'polls' => config('shorts.permalink_attempts') - 1]);
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    expect($p->fresh()->status)->toBe('published');
    expect($p->fresh()->stage)->toBe('done');
    expect($p->fresh()->media_id)->toBe('123');
    Queue::assertNothingPushed();
    Http::assertNothingSent();
});

test('recovering old Facebook permalink records normalizes saved paths or schedules only metadata reads', function () {
    $video = shortDraft(shortUser());
    $video->update(['status' => 'archived']);
    $p = $video->publications()->create(['platform' => 'facebook', 'status' => 'published', 'stage' => 'done', 'media_id' => '123', 'permalink' => '/reel/provider-returned/']);
    $this->artisan('shorts:recover-facebook-permalinks')->assertSuccessful();
    expect($p->fresh()->permalink)->toBe('https://www.facebook.com/reel/provider-returned/');
    Queue::assertNothingPushed();
    $p->update(['permalink' => null]);
    $this->artisan('shorts:recover-facebook-permalinks')->assertSuccessful();
    $this->artisan('shorts:recover-facebook-permalinks')->assertSuccessful();
    Queue::assertPushed(PublishShortVideo::class, 1);
    expect($p->fresh()->status)->toBe('published');
    expect($p->fresh()->stage)->toBe('permalink');
    expect($video->fresh()->status)->toBe('archived');
    Http::assertNothingSent();
});

test('provider permalink normalization rejects external origins credentials and protocol relative paths', function () {
    foreach (['//evil.test/path', '/\\evil.test', 'https://facebook.com.evil.test/a', 'https://user:pass@facebook.com/a', 'javascript:alert(1)', 'https://res.cloudinary.com/a.mp4'] as $url) {
        expect(PublicationPermalink::normalize('facebook', $url))->toBeNull();
    }
    expect(PublicationPermalink::normalize('instagram', 'https://www.instagram.com/reel/saved/'))->toBe('https://www.instagram.com/reel/saved/');
});

test('video progress reports backend pending work through permalink completion without dispatching jobs', function () {
    $user = shortUser();
    $video = shortDraft($user);
    $video->update(['status' => 'published']);
    $record = $video->publications()->create(['platform' => 'instagram', 'status' => 'processing', 'stage' => 'wait']);
    $this->actingAs($user);
    $url = '/admin/short-videos/'.$video->id.'/status';
    $this->getJson($url)->assertOk()->assertJsonPath('result.pending', true)->assertJsonPath('result.results.instagram.status', 'processing');
    $record->update(['status' => 'published', 'stage' => 'permalink', 'media_id' => '123']);
    $this->getJson($url)->assertJsonPath('result.pending', true)->assertJsonPath('result.results.instagram.success', true);
    $record->update(['stage' => 'done', 'permalink' => 'https://www.instagram.com/reel/saved/']);
    $this->getJson($url)->assertJsonPath('result.pending', false)->assertJsonPath('result.results.instagram.permalink', 'https://www.instagram.com/reel/saved/');
    $record->update(['status' => 'uncertain', 'stage' => 'publish_inflight']);
    $this->getJson($url)->assertJsonPath('result.pending', false)->assertJsonPath('result.results.instagram.success', false);
    Queue::assertNothingPushed();
    Http::assertNothingSent();
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
    $this->postJson('/admin/short-videos/upload', ['video' => UploadedFile::fake()->create('short.mp4', 100, 'video/mp4')])->assertCreated()->assertJsonPath('video.metadata.codec', 'h264')->assertJsonPath('video.status', 'draft');
});
test('uploading a replacement updates the owned draft instead of creating another record', function () {
    $user = shortUser();
    $draft = shortDraft($user);
    $this->actingAs($user);
    $this->mock(VideoInspector::class)->shouldReceive('inspect')->once()->andReturn(shortMetadata());
    $this->mock(CloudinaryVideoService::class)->shouldReceive('upload')->once()->andReturn(['secure_url' => 'https://res.cloudinary.com/demo/video/upload/replacement.mp4', 'public_id' => 'replacement'])->getMock()->shouldReceive('frame')->once()->with('replacement', 0)->andReturn('https://res.cloudinary.com/demo/video/upload/so_0/replacement.jpg');
    $this->postJson('/admin/short-videos/upload', ['short_video_id' => $draft->id, 'video' => UploadedFile::fake()->create('replacement.mp4', 100, 'video/mp4')])->assertOk()->assertJsonPath('video.id', $draft->id)->assertJsonPath('video.video_public_id', 'replacement');
    expect(ShortVideo::query()->count())->toBe(1);
});
test('another user cannot replace an existing draft video', function () {
    $owner = shortUser();
    $draft = shortDraft($owner);
    $this->actingAs(shortUser());
    $this->mock(VideoInspector::class)->shouldNotReceive('inspect');
    $this->mock(CloudinaryVideoService::class)->shouldNotReceive('upload');
    $this->postJson('/admin/short-videos/upload', ['short_video_id' => $draft->id, 'video' => UploadedFile::fake()->create('replacement.mp4', 100, 'video/mp4')])->assertForbidden();
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

test('Instagram and Facebook send the same formatted title and description while MySQL fields remain separate', function () {
    $user = shortUser();
    $video = shortDraft($user);
    $video->update(['title' => 'Gotong-Royong Desa 🏡', 'description' => "  Warga menjaga kebersihan. #Desa\nBaris kedua 😊  "]);
    shortConnection($user, 'instagram');
    shortConnection($user, 'facebook');
    $this->actingAs($user);
    $caption = "Gotong-Royong Desa 🏡\n\nWarga menjaga kebersihan. #Desa\nBaris kedua 😊";
    $this->postJson('/admin/short-videos/'.$video->id.'/preview', ['platforms' => ['website', 'instagram', 'facebook']])->assertOk()->assertJsonPath('caption', $caption);
    shortPublish($this, $video, ['website', 'instagram', 'facebook']);
    Http::fake(['*/123/media' => Http::response(['id' => '456']), '*/123/video_reels' => Http::sequence()->push(['video_id' => '789'])->push(['success' => true]), 'https://rupload.facebook.com/*' => Http::response(['success' => true])]);
    $instagram = $video->publications()->where('platform', 'instagram')->first();
    $facebook = $video->publications()->where('platform', 'facebook')->first();
    app(ReelPublisher::class)->step($instagram);
    app(ReelPublisher::class)->step($facebook);
    app(ReelPublisher::class)->step($facebook->fresh());
    app(ReelPublisher::class)->step($facebook->fresh());
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/123/media') && $request['caption'] === $caption);
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/123/video_reels') && $request['upload_phase'] === 'finish' && $request['title'] === $video->title && $request['description'] === $caption);
    expect($video->fresh()->title)->toBe('Gotong-Royong Desa 🏡');
    expect($video->fresh()->description)->toBe("  Warga menjaga kebersihan. #Desa\nBaris kedua 😊  ");
});

test('caption formatter handles empty descriptions and existing title prefixes without duplication', function () {
    $video = shortDraft(shortUser());
    $video->update(['title' => 'Kegiatan Desa', 'description' => '   ']);
    expect(ReelCaption::format($video->fresh()))->toBe('Kegiatan Desa');
    $video->update(['description' => "  Kegiatan Desa\n\nWarga berkumpul. #Desa  "]);
    expect(ReelCaption::format($video->fresh()))->toBe("Kegiatan Desa\n\nWarga berkumpul. #Desa");
    $video->update(['description' => 'Kegiatan Desaku berlangsung']);
    expect(ReelCaption::format($video->fresh()))->toBe("Kegiatan Desa\n\nKegiatan Desaku berlangsung");
});

test('combined social caption limits reject oversized previews without publishing or changing the draft', function () {
    $user = shortUser();
    $video = shortDraft($user);
    $this->actingAs($user);
    $video->update(['description' => str_repeat('a', 2190)]);
    $this->postJson('/admin/short-videos/'.$video->id.'/preview', ['platforms' => ['website', 'instagram']])->assertUnprocessable();
    $video->update(['description' => str_repeat('a', 9995)]);
    $this->postJson('/admin/short-videos/'.$video->id.'/preview', ['platforms' => ['website', 'facebook']])->assertUnprocessable();
    expect($video->fresh()->status)->toBe('draft');
    expect($video->publications()->count())->toBe(0);
    Queue::assertNothingPushed();
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
    $this->postJson('/admin/short-videos/'.$v->id.'/archive')->assertUnprocessable();
    $p->update(['status' => 'failed']);
    $this->postJson('/admin/short-videos/'.$v->id.'/archive')->assertOk();
    (new PublishShortVideo($p->id))->handle(app(ReelPublisher::class));
    Http::assertNothingSent();
});

test('selected retries dispatch exactly the failed destinations and reject repeated or unsafe selections', function (array $selected) {
    $user = shortUser();
    $video = shortDraft($user);
    $this->actingAs($user);
    shortConnection($user, 'instagram');
    shortConnection($user, 'facebook');
    shortPublish($this, $video, ['website', 'instagram', 'facebook']);
    $video->publications()->whereIn('platform', ['instagram', 'facebook'])->update(['status' => 'failed']);
    Queue::fake();
    $this->postJson('/admin/short-videos/'.$video->id.'/retry-selected', ['platforms' => $selected])->assertOk();
    Queue::assertPushed(PublishShortVideo::class, count($selected));
    foreach ($selected as $platform) {
        expect($video->publications()->where('platform', $platform)->first()->status)->toBe('queued');
    }
    $this->postJson('/admin/short-videos/'.$video->id.'/retry-selected', ['platforms' => $selected])->assertUnprocessable();
    $this->postJson('/admin/short-videos/'.$video->id.'/retry-selected', ['platforms' => ['website']])->assertUnprocessable();
})->with([[['instagram']], [['facebook']], [['instagram', 'facebook']]]);

test('uncertain destinations cannot enter selected retry and archive restore preserves media and social records', function () {
    $user = shortUser();
    $video = shortDraft($user);
    $this->actingAs($user);
    shortConnection($user, 'instagram');
    shortPublish($this, $video, ['website', 'instagram']);
    $p = $video->publications()->where('platform', 'instagram')->first();
    $p->update(['status' => 'uncertain', 'stage' => 'publish_inflight', 'container_id' => '777']);
    Queue::fake();
    $this->postJson('/admin/short-videos/'.$video->id.'/retry-selected', ['platforms' => ['instagram']])->assertUnprocessable();
    Queue::assertNothingPushed();
    $this->postJson('/admin/short-videos/'.$video->id.'/archive')->assertUnprocessable();
    $p->update(['status' => 'published', 'stage' => 'done', 'media_id' => '888']);
    $this->postJson('/admin/short-videos/'.$video->id.'/archive')->assertOk();
    $this->get('/')->assertInertia(fn (Assert $p) => $p->has('shorts', 0));
    $this->postJson('/admin/short-videos/'.$video->id.'/restore')->assertOk();
    $this->get('/')->assertInertia(fn (Assert $p) => $p->where('shorts.0.id', $video->id));
    expect($p->fresh()->media_id)->toBe('888');
    expect($video->fresh()->video_url)->toBe($video->video_url);
    Queue::assertNothingPushed();
    $this->postJson('/admin/short-videos/'.$video->id.'/delete')->assertUnprocessable();
});

test('mixed unsafe retries are atomic and video management enforces ownership and draft deletion', function () {
    $user = shortUser();
    $video = shortDraft($user);
    $this->actingAs($user);
    shortConnection($user, 'instagram');
    shortConnection($user, 'facebook');
    shortPublish($this, $video, ['website', 'instagram', 'facebook']);
    $video->publications()->where('platform', 'instagram')->update(['status' => 'failed']);
    Queue::fake();
    $this->postJson('/admin/short-videos/'.$video->id.'/retry-selected', ['platforms' => ['instagram', 'facebook']])->assertUnprocessable();
    expect($video->publications()->where('platform', 'instagram')->first()->status)->toBe('failed');
    Queue::assertNothingPushed();
    $this->actingAs(shortUser('moderator'));
    $this->postJson('/admin/short-videos/'.$video->id.'/restore')->assertForbidden();
    $this->postJson('/admin/short-videos/'.$video->id.'/archive')->assertForbidden();
    $this->postJson('/admin/short-videos/'.$video->id.'/retry-selected', ['platforms' => ['instagram']])->assertForbidden();
    $this->actingAs($user);
    $draft = shortDraft($user);
    $this->postJson('/admin/short-videos/'.$draft->id.'/delete')->assertOk();
    expect($draft->fresh()->deleted_at)->not->toBeNull();
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

test('shorts list and publication routes preserve roles ownership and draft deep links', function () {
    foreach (['admin', 'moderator'] as $role) {
        $user = shortUser($role);
        $draft = shortDraft($user);
        $this->actingAs($user);
        $this->get('/admin/short-videos')->assertInertia(fn (Assert $p) => $p->where('mode', 'list')->has('videos.data', 1));
        $this->get('/admin/short-videos/create')->assertInertia(fn (Assert $p) => $p->where('mode', 'editor')->where('draft', null));
        $this->get('/admin/short-videos/create?draft='.$draft->id)->assertInertia(fn (Assert $p) => $p->where('draft.id', $draft->id));
        $other = shortDraft(shortUser());
        $this->get('/admin/short-videos/create?draft='.$other->id)->assertForbidden();
    }
    $this->actingAs(shortUser('villager'))->get('/admin/short-videos/create')->assertRedirect('/');
});

test('video management searches filters and paginates only owned records with publication statuses', function () {
    $user = shortUser();
    $this->actingAs($user);
    $published = shortDraft($user);
    $published->update(['title' => 'Festival terbit', 'status' => 'published', 'published_at' => now()]);
    $published->publications()->create(['platform' => 'website', 'status' => 'published']);
    $published->publications()->create(['platform' => 'instagram', 'status' => 'failed', 'error_summary' => 'Publikasi ditolak.']);
    $archive = shortDraft($user);
    $archive->update(['title' => 'Festival arsip', 'status' => 'archived']);
    foreach (range(1, 13) as $i) {
        shortDraft($user)->update(['title' => 'Draf '.$i]);
    }
    shortDraft(shortUser())->update(['title' => 'Festival rahasia', 'status' => 'published']);
    $this->get('/admin/short-videos?search=Festival&status=published')->assertInertia(fn (Assert $p) => $p
        ->has('videos.data', 1)->where('videos.data.0.id', $published->id)
        ->where('videos.data.0.status', 'published')->has('videos.data.0.publications', 2)
        ->where('filters.search', 'Festival')->where('filters.status', 'published'));
    $this->get('/admin/short-videos?status=archived')->assertInertia(fn (Assert $p) => $p->has('videos.data', 1)->where('videos.data.0.id', $archive->id));
    $this->get('/admin/short-videos?status=draft&page=2')->assertInertia(fn (Assert $p) => $p->has('videos.data', 1)->where('videos.total', 13)->where('videos.current_page', 2));
    $this->get('/admin/short-videos?search=tidak-ada')->assertInertia(fn (Assert $p) => $p->has('videos.data', 0));
    $this->getJson('/admin/short-videos?status=invalid')->assertUnprocessable();
});
