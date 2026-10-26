<?php

use App\Jobs\ProcessShortVideo;
use App\Jobs\PublishShortVideo;
use App\Models\ShortVideo;
use App\Models\SocialConnection;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Shorts\CloudinaryVideoService;
use App\Services\Shorts\LocalShortMedia;
use App\Services\Shorts\PublicationPermalink;
use App\Services\Shorts\ReelCaption;
use App\Services\Shorts\ReelPublisher;
use App\Services\Shorts\VideoCropper;
use App\Services\Shorts\VideoInspector;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

function finishShortDraft(int $id): void
{
    $video = ShortVideo::findOrFail($id);
    (new ProcessShortVideo($id, $video->metadata['processing']['revision']))->handle(app(VideoCropper::class), app(LocalShortMedia::class));
}

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
    return ShortVideo::create(['created_by' => $user->getKey(), 'title' => 'Video desa', 'description' => 'Kegiatan warga di desa', 'video_url' => 'https://res.cloudinary.com/demo/video/upload/short.mp4', 'video_public_id' => 'short', 'thumbnail_url' => 'https://res.cloudinary.com/demo/video/upload/so_0/short.jpg', 'metadata' => shortMetadata()]);
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

test('landscape upload crop save draft publish sends cropped URL to both platforms', function () {
    $user = shortUser();
    $this->actingAs($user);
    shortConnection($user, 'instagram');
    shortConnection($user, 'facebook');
    $socialUrl = 'https://res.cloudinary.com/demo/video/upload/confirmed-crop.mp4';
    $croppedUrl = 'http://localhost/storage/shorts/edits/confirmed-crop.mp4';
    $inspector = Mockery::mock(VideoInspector::class)->makePartial();
    $inspector->shouldReceive('inspect')->once()->andReturn(array_replace(shortMetadata(), ['width' => 1920, 'height' => 1080]));
    $this->app->instance(VideoInspector::class, $inspector);
    $cloud = Mockery::mock(CloudinaryVideoService::class)->makePartial();
    $cloud->shouldReceive('upload')->once()->andReturn(['secure_url' => $socialUrl, 'public_id' => 'confirmed-crop']);
    $this->app->instance(CloudinaryVideoService::class, $cloud);
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->with(Mockery::any(), Mockery::on(fn ($edit) => $edit['mode'] === 'fit'), Mockery::any())->andReturn([
        'asset' => ['url' => 'http://localhost/storage/shorts/edits/fit.mp4', 'path' => 'shorts/edits/fit.mp4'], 'metadata' => shortMetadata(),
    ]);
    $cloud->shouldReceive('cover')->once()->andReturn(['url' => 'https://res.cloudinary.com/demo/image/upload/frame.jpg', 'public_id' => null]);
    $uploaded = $this->postJson('/admin/short-videos/upload', ['video' => UploadedFile::fake()->create('wide.mp4', 100, 'video/mp4')])->assertCreated();
    $id = $uploaded->json('video.id');
    $originalUrl = $uploaded->json('video.metadata.crop_source.url');
    $originalPath = $uploaded->json('video.metadata.crop_source.path');
    finishShortDraft($id);
    $readyUrl = ShortVideo::findOrFail($id)->video_url;
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->with($originalUrl, Mockery::any(), $originalPath)->andReturn([
        'asset' => ['url' => $croppedUrl, 'path' => 'shorts/edits/confirmed-crop.mp4'], 'metadata' => shortMetadata(),
    ]);
    Storage::disk('public')->put('shorts/edits/confirmed-crop.mp4', 'edited bytes');
    $this->postJson('/admin/short-videos/'.$id.'/crop', ['expected_url' => $readyUrl, 'x' => 0.75, 'y' => 0.5, 'zoom' => 1, 'start' => 0, 'end' => 20])
        ->assertOk()->assertJsonPath('video.metadata.processing.status', 'queued')->assertJsonPath('video.metadata.crop_source.url', $originalUrl);
    finishShortDraft($id);
    expect(ShortVideo::findOrFail($id)->video_url)->toBe($croppedUrl);
    Storage::disk('public')->assertExists($originalPath);
    $this->postJson('/admin/short-videos/'.$id, ['title' => 'Confirmed crop', 'description' => 'Preserved caption for publishing', 'frame_offset' => 0, 'cover_mode' => 'keep'])->assertOk();
    $video = ShortVideo::findOrFail($id);
    shortPublish($this, $video, ['website', 'instagram', 'facebook'])->assertOk();
    expect($video->fresh()->video_url)->toBe($croppedUrl);
    Http::fake([
        '*/123/media' => Http::response(['id' => '456']),
        '*/123/video_reels' => Http::sequence()->push(['video_id' => '567'])->push(['success' => true]),
        'https://rupload.facebook.com/*' => Http::response(['success' => true]),
        '*/456*' => Http::response(['status_code' => 'FINISHED']),
        '*/123/media_publish' => Http::response(['id' => '789']),
        '*/567*' => Http::response(['status' => ['publishing_phase' => ['status' => 'complete']]]),
    ]);
    $publisher = app(ReelPublisher::class);
    $ig = $video->publications()->where('platform', 'instagram')->firstOrFail();
    $fb = $video->publications()->where('platform', 'facebook')->firstOrFail();
    for ($step = 0; $step < 2; $step++) {
        $publisher->step($ig->fresh());
    }
    for ($step = 0; $step < 4; $step++) {
        $publisher->step($fb->fresh());
    }
    expect($ig->fresh()->status)->toBe('published');
    expect($fb->fresh()->status)->toBe('published');
    Http::assertSent(fn ($r) => str_ends_with($r->url(), '/123/media') && $r['video_url'] === $socialUrl);
    Http::assertSent(fn ($r) => str_contains($r->url(), 'rupload.facebook.com') && $r->hasHeader('file_url', $socialUrl));
    Http::assertNotSent(fn ($r) => ($r['video_url'] ?? null) === $originalUrl || $r->hasHeader('file_url', $originalUrl));
    expect($video->fresh()->metadata['crop_source']['url'])->toBe($originalUrl);
    expect($video->fresh()->title)->toBe('Confirmed crop');
});

test('local edited drafts survive reload and website publishing never uploads to Cloudinary', function () {
    $user = shortUser();
    $this->actingAs($user);
    $path = 'shorts/edits/persisted.mp4';
    Storage::disk('public')->put($path, 'edited bytes');
    $video = shortDraft($user);
    $video->update(['video_url' => Storage::disk('public')->url($path), 'video_public_id' => '',
        'thumbnail_url' => 'http://localhost/storage/shorts/covers/frame.jpg',
        'metadata' => [...shortMetadata(), 'local_path' => $path, 'cover_source' => 'frame',
            'crop_source' => ['url' => 'https://res.cloudinary.com/demo/video/upload/original.mp4', 'metadata' => shortMetadata()],
            'video_crop' => ['x' => .5, 'y' => .5, 'zoom' => 2, 'start' => 1, 'end' => 21]]]);
    $this->mock(CloudinaryVideoService::class)->shouldNotReceive('upload');
    $this->postJson('/admin/short-videos/'.$video->id, ['title' => 'Local edit', 'description' => 'Persisted content for publishing', 'frame_offset' => 0, 'cover_mode' => 'keep'])->assertOk();
    $this->get('/admin/short-videos/create?draft='.$video->id)->assertInertia(fn (Assert $page) => $page
        ->where('draft.video_url', Storage::disk('public')->url($path))
        ->where('draft.metadata.video_crop.start', 1));
    shortPublish($this, $video->fresh(), ['website'])->assertOk();
    expect($video->fresh()->video_url)->toBe(Storage::disk('public')->url($path));
    Storage::disk('public')->assertExists($path);
});

test('each social destination receives the final local edit through one reusable Cloudinary asset', function (array $platforms) {
    $user = shortUser();
    $this->actingAs($user);
    foreach (array_diff($platforms, ['website']) as $platform) {
        shortConnection($user, $platform);
    }
    $path = 'shorts/edits/final.mp4';
    Storage::disk('public')->put($path, 'final edited bytes');
    $video = shortDraft($user);
    $video->update(['video_url' => Storage::disk('public')->url($path), 'video_public_id' => '',
        'metadata' => [...shortMetadata(), 'local_path' => $path, 'video_crop' => ['x' => .5, 'y' => .5, 'zoom' => 2, 'start' => 1, 'end' => 21]]]);
    $socialUrl = 'https://res.cloudinary.com/demo/video/upload/final.mp4';
    $cloud = Mockery::mock(CloudinaryVideoService::class)->makePartial();
    $cloud->shouldReceive('upload')->once()->andReturn(['secure_url' => $socialUrl, 'public_id' => 'final']);
    $this->app->instance(CloudinaryVideoService::class, $cloud);
    shortPublish($this, $video, $platforms)->assertOk();
    shortPublish($this, $video->fresh(), $platforms)->assertOk();
    expect($video->fresh()->metadata['social_asset']['url'])->toBe($socialUrl);
    expect($video->fresh()->video_url)->toBe(Storage::disk('public')->url($path));
    Http::fake(['*/123/media' => Http::response(['id' => '456']), '*/123/video_reels' => Http::response(['video_id' => '567']),
        'https://rupload.facebook.com/*' => Http::response(['success' => true])]);
    foreach (array_diff($platforms, ['website']) as $platform) {
        $publication = $video->publications()->where('platform', $platform)->firstOrFail();
        app(ReelPublisher::class)->step($publication);
        if ($platform === 'facebook') {
            app(ReelPublisher::class)->step($publication->fresh());
        }
    }
    if (in_array('instagram', $platforms)) {
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/123/media') && $request['video_url'] === $socialUrl);
    }
    if (in_array('facebook', $platforms)) {
        Http::assertSent(fn ($request) => str_contains($request->url(), 'rupload.facebook.com') && $request->hasHeader('file_url', $socialUrl));
    }
})->with([[['website', 'instagram']], [['website', 'facebook']]]);

test('social upload failure keeps the local draft and edited file', function () {
    $user = shortUser();
    $this->actingAs($user);
    shortConnection($user, 'instagram');
    $path = 'shorts/edits/retry.mp4';
    Storage::disk('public')->put($path, 'edited bytes');
    $video = shortDraft($user);
    $video->update(['video_url' => Storage::disk('public')->url($path), 'video_public_id' => '', 'metadata' => [...shortMetadata(), 'local_path' => $path]]);
    $this->mock(CloudinaryVideoService::class)->shouldReceive('upload')->once()->andThrow(ValidationException::withMessages(['video' => 'Upload failed']));
    $token = $this->postJson('/admin/short-videos/'.$video->id.'/preview', ['platforms' => ['website', 'instagram']])->assertOk()->json('token');
    $this->postJson('/admin/short-videos/'.$video->id.'/publish', ['platforms' => ['website', 'instagram'], 'preview_token' => $token])->assertUnprocessable();
    expect($video->fresh()->status)->toBe('draft');
    expect($video->publications()->count())->toBe(0);
    Storage::disk('public')->assertExists($path);
});

test('a matching cached social asset is reused without uploading the local edit again', function () {
    $user = shortUser();
    $this->actingAs($user);
    shortConnection($user, 'instagram');
    $path = 'shorts/edits/cached.mp4';
    Storage::disk('public')->put($path, 'edited bytes');
    $url = 'https://res.cloudinary.com/demo/video/upload/cached.mp4';
    $video = shortDraft($user);
    $video->update(['video_url' => Storage::disk('public')->url($path), 'video_public_id' => '',
        'metadata' => [...shortMetadata(), 'local_path' => $path,
            'social_asset' => ['source_path' => $path, 'url' => $url, 'public_id' => 'cached']]]);
    $this->mock(CloudinaryVideoService::class)->makePartial()->shouldNotReceive('upload');
    shortPublish($this, $video, ['website', 'instagram'])->assertOk();
    Http::fake(['*/123/media' => Http::response(['id' => '456'])]);
    app(ReelPublisher::class)->step($video->publications()->where('platform', 'instagram')->firstOrFail());
    Http::assertSent(fn ($request) => $request['video_url'] === $url);
});

test('deleting a local draft cleans its edit and preserved original', function () {
    $user = shortUser();
    $this->actingAs($user);
    foreach (['shorts/original/source.mp4', 'shorts/edits/edit.mp4', 'shorts/covers/frame.jpg'] as $path) {
        Storage::disk('public')->put($path, 'media');
    }
    $video = shortDraft($user);
    $video->update(['video_url' => Storage::disk('public')->url('shorts/edits/edit.mp4'), 'video_public_id' => '',
        'thumbnail_url' => Storage::disk('public')->url('shorts/covers/frame.jpg'),
        'metadata' => [...shortMetadata(), 'local_path' => 'shorts/edits/edit.mp4',
            'crop_source' => ['url' => Storage::disk('public')->url('shorts/original/source.mp4'), 'path' => 'shorts/original/source.mp4', 'metadata' => shortMetadata()]]]);
    $this->postJson('/admin/short-videos/'.$video->id.'/delete')->assertOk();
    foreach (['shorts/original/source.mp4', 'shorts/edits/edit.mp4', 'shorts/covers/frame.jpg'] as $path) {
        Storage::disk('public')->assertMissing($path);
    }
});

test('a publishing lease blocks replacement, draft updates, and deletion', function () {
    $user = shortUser();
    $this->actingAs($user);
    $video = shortDraft($user);
    $lock = Cache::lock('short-crop:'.$video->id, 30);
    expect($lock->get())->toBeTrue();
    try {
        $this->postJson('/admin/short-videos/upload', ['short_video_id' => $video->id,
            'video' => UploadedFile::fake()->create('replacement.mp4', 100, 'video/mp4')])->assertStatus(409);
        $this->postJson('/admin/short-videos/'.$video->id, ['title' => 'Changed', 'description' => 'Text',
            'frame_offset' => 0, 'cover_mode' => 'keep'])->assertStatus(409);
        $this->postJson('/admin/short-videos/'.$video->id.'/delete')->assertStatus(409);
    } finally {
        $lock->release();
    }
    expect($video->fresh()->status)->toBe('draft');
});

test('local media cleanup rejects paths outside generated Shorts files', function () {
    $local = app(LocalShortMedia::class);
    expect($local->pathFromUrl('https://example.com/storage/shorts/../private/secret.mp4'))->toBeNull();
    $local->delete('shorts/../private/secret.mp4');
    expect($local->pathFromUrl(Storage::disk('public')->url('shorts/covers/frame.jpg')))->toBe('shorts/covers/frame.jpg');
});
beforeEach(function () {
    Queue::fake();
    Http::preventStrayRequests();
    Storage::fake('public');
    config(['services.cloudinary.cloud_name' => 'demo']);
    $local = Mockery::mock(LocalShortMedia::class)->makePartial();
    $local->shouldReceive('frame')->andReturnUsing(function () {
        $file = UploadedFile::fake()->image('frame.jpg');
        $path = 'shorts/covers/'.Str::uuid().'.jpg';
        Storage::disk('public')->put($path, file_get_contents($file->getRealPath()));

        return Storage::disk('public')->url($path);
    });
    $this->app->instance(LocalShortMedia::class, $local);
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

test('video progress ends on confirmed publication while permalink lookup continues without dispatching jobs', function () {
    $user = shortUser();
    $video = shortDraft($user);
    $video->update(['status' => 'published']);
    $record = $video->publications()->create(['platform' => 'instagram', 'status' => 'processing', 'stage' => 'wait']);
    $this->actingAs($user);
    $url = '/admin/short-videos/'.$video->id.'/status';
    $this->getJson($url)->assertOk()->assertJsonPath('result.pending', true)->assertJsonPath('result.results.instagram.status', 'processing');
    $record->update(['status' => 'published', 'stage' => 'permalink', 'media_id' => '123']);
    $this->getJson($url)->assertJsonPath('result.pending', false)->assertJsonPath('result.permalink_pending', true)->assertJsonPath('result.results.instagram.success', true);
    $record->update(['stage' => 'done', 'permalink' => 'https://www.instagram.com/reel/saved/']);
    $this->getJson($url)->assertJsonPath('result.pending', false)->assertJsonPath('result.permalink_pending', false)->assertJsonPath('result.results.instagram.permalink', 'https://www.instagram.com/reel/saved/');
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
test('saved active thumbnail source is returned to editor and used by Instagram publishing', function () {
    $user = shortUser();
    $this->actingAs($user);
    shortConnection($user, 'instagram');
    $video = shortDraft($user);
    $photo = 'https://res.cloudinary.com/demo/image/upload/photo.jpg';
    $frame = 'https://res.cloudinary.com/demo/video/upload/so_4.500,f_jpg/short.jpg';
    $cloud = Mockery::mock(CloudinaryVideoService::class)->makePartial();
    $cloud->shouldReceive('cover')->once()->with(null, 'short', 4.5)->andReturn(['url' => $frame, 'public_id' => null]);
    $cloud->shouldReceive('cover')->once()->with(Mockery::type(UploadedFile::class), 'short', 4.5)->andReturn(['url' => $photo, 'public_id' => null]);
    $this->app->instance(CloudinaryVideoService::class, $cloud);
    $video->update(['thumbnail_url' => $photo]);
    $this->postJson('/admin/short-videos/'.$video->id, ['title' => $video->title, 'description' => $video->description, 'frame_offset' => 4.5, 'cover_mode' => 'frame'])
        ->assertOk()->assertJsonPath('video.thumbnail_url', $frame)->assertJsonPath('video.frame_offset', 4.5);
    $this->post('/admin/short-videos/'.$video->id, ['title' => $video->title, 'description' => $video->description, 'frame_offset' => 4.5, 'cover_mode' => 'upload', 'cover' => UploadedFile::fake()->image('photo.jpg')], ['Accept' => 'application/json'])
        ->assertOk();
    $localPhoto = $video->fresh()->thumbnail_url;
    $this->get('/admin/short-videos/create?draft='.$video->id)->assertInertia(fn (Assert $page) => $page->where('draft.thumbnail_url', $localPhoto)->where('draft.frame_offset', 4.5));
    shortPublish($this, $video->fresh(), ['website', 'instagram'])->assertOk();
    Http::fake(['*/123/media' => Http::response(['id' => '456'])]);
    app(ReelPublisher::class)->step($video->publications()->where('platform', 'instagram')->firstOrFail());
    Http::assertSent(fn ($request) => $request['cover_url'] === $photo);
    expect($video->fresh()->thumbnail_url)->toBe($localPhoto);
});

test('upload persists a local draft without Cloudinary', function () {
    $u = shortUser();
    $this->actingAs($u);
    $this->mock(VideoInspector::class)->shouldReceive('inspect')->once()->andReturn(shortMetadata());
    $this->mock(CloudinaryVideoService::class)->shouldNotReceive('upload');
    $response = $this->postJson('/admin/short-videos/upload', ['video' => UploadedFile::fake()->create('short.mp4', 100, 'video/mp4')])->assertCreated()->assertJsonPath('video.metadata.codec', 'h264')->assertJsonPath('video.status', 'draft');
    Storage::disk('public')->assertExists($response->json('video.metadata.local_path'));
    expect($response->json('video.video_url'))->toContain('/short-media/original/');
});
test('uploading a replacement updates the owned draft instead of creating another record', function () {
    $user = shortUser();
    $draft = shortDraft($user);
    $this->actingAs($user);
    $this->mock(VideoInspector::class)->shouldReceive('inspect')->once()->andReturn(shortMetadata());
    $this->mock(CloudinaryVideoService::class)->shouldNotReceive('upload');
    $this->postJson('/admin/short-videos/upload', ['short_video_id' => $draft->id, 'video' => UploadedFile::fake()->create('replacement.mp4', 100, 'video/mp4')])->assertOk()->assertJsonPath('video.id', $draft->id)->assertJsonPath('video.video_public_id', '');
    Storage::disk('public')->assertExists($draft->fresh()->metadata['local_path']);
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

test('rejecting an empty title leaves the saved draft and media unchanged', function () {
    $user = shortUser();
    $video = shortDraft($user);
    $this->actingAs($user);

    $this->postJson('/admin/short-videos/'.$video->id, [
        'title' => '', 'description' => '', 'frame_offset' => 0, 'cover_mode' => 'keep',
    ])->assertUnprocessable()->assertJsonPath('errors.title.0', 'Judul video wajib diisi.');

    expect(ShortVideo::count())->toBe(1);
    expect($video->fresh()->video_url)->toBe($video->video_url);
    expect($video->fresh()->thumbnail_url)->toBe($video->thumbnail_url);
    $this->get('/admin/short-videos/create?draft='.$video->id)->assertInertia(fn (Assert $page) => $page
        ->where('draft.id', $video->id)
        ->where('draft.title', 'Video desa')
        ->where('draft.description', 'Kegiatan warga di desa')
        ->where('draft.video_url', $video->video_url)
        ->where('draft.thumbnail_url', $video->thumbnail_url));
    expect($video->fresh()->status)->toBe('draft');
});

test('a titled draft with no description can be saved but not published', function () {
    $user = shortUser();
    $video = shortDraft($user);
    $this->actingAs($user);
    $this->postJson('/admin/short-videos/'.$video->id, [
        'title' => 'Video desa', 'description' => '', 'frame_offset' => 0, 'cover_mode' => 'keep',
    ])->assertOk();
    $this->postJson('/admin/short-videos/'.$video->id.'/preview', [
        'platforms' => ['website'],
    ])->assertUnprocessable()->assertJsonPath('errors.description.0', 'Konten minimal 20 karakter untuk diterbitkan.');
    expect($video->fresh()->status)->toBe('draft');
});

test('short title and rich content limits count visible text and preserve safe formatting', function () {
    $user = shortUser();
    $video = shortDraft($user);
    $this->actingAs($user);
    $url = '/admin/short-videos/'.$video->id;

    $this->postJson($url, ['title' => str_repeat('J', 201), 'description' => 'Konten yang cukup panjang', 'frame_offset' => 0, 'cover_mode' => 'keep'])
        ->assertUnprocessable()->assertJsonPath('errors.title.0', 'Judul maksimal 200 karakter.');
    $this->postJson($url, ['title' => 'Judul aman', 'description' => '<p>'.str_repeat('a', 2001).'</p>', 'frame_offset' => 0, 'cover_mode' => 'keep'])
        ->assertUnprocessable()->assertJsonPath('errors.description.0', 'Konten maksimal 2.000 karakter.');
    $this->postJson($url, ['title' => 'Judul aman', 'description' => '<p><strong>Singkat</strong></p>', 'frame_offset' => 0, 'cover_mode' => 'keep'])
        ->assertOk();
    $this->postJson($url.'/preview', ['platforms' => ['website']])
        ->assertUnprocessable()->assertJsonPath('errors.description.0', 'Konten minimal 20 karakter untuk diterbitkan.');
    $this->postJson($url, ['title' => str_repeat('J', 200), 'description' => '<p><strong>Konten berita desa hari ini</strong></p><script>alert(1)</script>', 'frame_offset' => 0, 'cover_mode' => 'keep'])
        ->assertOk();
    expect($video->fresh()->description)->toContain('<strong>Konten berita desa hari ini</strong>')->not->toContain('<script>');
    $this->get('/admin/short-videos/create?draft='.$video->id)->assertInertia(fn (Assert $page) => $page
        ->where('draft.title', str_repeat('J', 200))
        ->where('draft.description', $video->fresh()->description));
    $this->postJson($url.'/preview', ['platforms' => ['website']])
        ->assertOk()->assertJsonPath('caption', str_repeat('J', 200)."\n\nKonten berita desa hari ini");
    $this->postJson($url, ['frame_offset' => 0, 'cover_mode' => 'keep'])
        ->assertOk()->assertJsonPath('video.description', $video->fresh()->description);
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
    $this->postJson('/admin/short-videos/'.$video->id, ['title' => 'New title', 'description' => 'Description for publication', 'frame_offset' => 4.5, 'cover_mode' => 'frame'])->assertOk()->assertJsonPath('video.frame_offset', 4.5);
    $this->get('/admin/short-videos')->assertInertia(fn (Assert $page) => $page->where('videos.data.0.frame_offset', 4.5)->where('videos.data.0.thumbnail_url', 'https://res.cloudinary.com/demo/video/upload/so_4.500/short.jpg'));
    $this->postJson('/admin/short-videos/'.$video->id, ['title' => 'New title', 'description' => 'Description for publication', 'frame_offset' => 4.5, 'cover_mode' => 'upload', 'cover' => UploadedFile::fake()->image('cover.jpg')])->assertOk();
    shortPublish($this, $video->fresh(), ['website'])->assertOk();
    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('shorts.0.thumbnail_url', $video->fresh()->thumbnail_url));
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

test('stale editor links redirect published videos to their detail and other states to the list', function () {
    $owner = shortUser();
    $published = shortDraft($owner);
    $published->update(['status' => 'published', 'published_at' => now()]);
    $archived = shortDraft($owner);
    $archived->update(['status' => 'archived']);
    $processing = shortDraft($owner);
    $processing->update(['status' => 'processing']);
    $failed = shortDraft($owner);
    $failed->update(['status' => 'failed']);
    $other = shortDraft(shortUser());
    $other->update(['status' => 'published', 'published_at' => now()]);

    $this->actingAs($owner);
    $this->get('/admin/short-videos/create?draft='.$published->id)->assertRedirect('/shorts/'.$published->id);
    $this->get('/admin/short-videos/create?draft='.$archived->id)
        ->assertRedirect('/admin/short-videos')
        ->assertSessionHas('shortNotice');
    foreach ([$processing, $failed] as $video) {
        $this->get('/admin/short-videos/create?draft='.$video->id)
            ->assertRedirect('/admin/short-videos')
            ->assertSessionHas('shortNotice');
    }
    $this->get('/admin/short-videos/create?draft='.$other->id)->assertForbidden();
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

test('gallery covers fit locally, preserve EXIF original and restore crop settings without duplicate rendering', function () {
    $video = shortDraft(shortUser());
    $this->actingAs(User::find($video->created_by));
    $image = imagecreatetruecolor(160, 90);
    imagefilledrectangle($image, 0, 0, 79, 89, imagecolorallocate($image, 255, 0, 0));
    imagefilledrectangle($image, 80, 0, 159, 89, imagecolorallocate($image, 0, 0, 255));
    ob_start();
    imagejpeg($image, null, 100);
    $jpeg = ob_get_clean();
    imagedestroy($image);
    $exif = "Exif\0\0".'II'.pack('vV', 42, 8).pack('v', 1).pack('vvV', 0x112, 3, 1).pack('v', 6)."\0\0".pack('V', 0);
    $jpeg = substr($jpeg, 0, 2)."\xff\xe1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2);
    $file = UploadedFile::fake()->createWithContent('oriented.jpg', $jpeg);
    $body = ['title' => $video->title, 'description' => $video->description, 'frame_offset' => 0, 'cover_mode' => 'upload', 'cover' => $file];
    $this->postJson('/admin/short-videos/'.$video->id, $body)->assertOk()->assertJsonPath('video.metadata.cover_crop.mode', 'fit');
    $video->refresh();
    $local = app(LocalShortMedia::class);
    $original = $video->metadata['cover_original'];
    expect(Storage::disk('public')->get($local->pathFromUrl($original)))->toBe($jpeg);
    $bytes = Storage::disk('public')->get($local->pathFromUrl($video->thumbnail_url));
    expect(array_slice(getimagesizefromstring($bytes), 0, 2))->toBe([1080, 1920]);
    $result = imagecreatefromstring($bytes);
    $top = imagecolorsforindex($result, imagecolorat($result, 540, 400));
    $bottom = imagecolorsforindex($result, imagecolorat($result, 540, 1500));
    expect($top['red'])->toBeGreaterThan(240);
    expect($bottom['blue'])->toBeGreaterThan(240);
    imagedestroy($result);
    unset($body['cover']);
    $body['cover_mode'] = 'keep';
    $body['cover_crop'] = ['mode' => 'crop', 'x' => '0.2', 'y' => '0.8', 'zoom' => '2'];
    $this->postJson('/admin/short-videos/'.$video->id, $body)->assertOk()->assertJsonPath('video.metadata.cover_original', $original);
    $url = $video->fresh()->thumbnail_url;
    $this->postJson('/admin/short-videos/'.$video->id, $body)->assertOk()->assertJsonPath('video.thumbnail_url', $url);
    $this->get('/admin/short-videos/create?draft='.$video->id)->assertInertia(fn (Assert $page) => $page->where('draft.metadata.cover_crop.zoom', 2)->where('draft.metadata.cover_original', $original));
    $this->postJson('/admin/short-videos/'.$video->id, [...$body, 'cover_mode' => 'frame'])->assertOk();
    $this->postJson('/admin/short-videos/'.$video->id, [...$body, 'cover_mode' => 'photo'])->assertOk()->assertJsonPath('video.metadata.cover_source', 'photo');
    Storage::disk('public')->assertExists($local->pathFromUrl($original));
});

test('confirmed initial crop exports once and preserves original with adjusted cover offset', function () {
    $this->actingAs(shortUser());
    $this->mock(VideoInspector::class)->shouldReceive('inspect')->once()->andReturn(shortMetadata());
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->with(Mockery::any(), Mockery::on(fn ($e) => $e['mode'] === 'crop' && $e['start'] == 5), Mockery::any())->andReturn([
        'asset' => ['url' => '/storage/shorts/edits/initial.mp4', 'path' => 'shorts/edits/initial.mp4'], 'metadata' => [...shortMetadata(), 'duration' => 5],
    ]);
    $response = $this->postJson('/admin/short-videos/upload', ['video' => UploadedFile::fake()->create('source.mp4', 100, 'video/mp4'), 'frame_offset' => 9,
        'edit' => ['mode' => 'crop', 'x' => '0.5', 'y' => '0.5', 'zoom' => '2', 'start' => '5', 'end' => '10']])
        ->assertCreated()->assertJsonPath('video.frame_offset', 4)->assertJsonPath('video.metadata.video_crop.start', 5)->assertJsonPath('video.metadata.crop_source.metadata.duration', 20);
    finishShortDraft($response->json('video.id'));
    expect(ShortVideo::findOrFail($response->json('video.id'))->metadata['processing']['status'])->toBe('ready');
});
