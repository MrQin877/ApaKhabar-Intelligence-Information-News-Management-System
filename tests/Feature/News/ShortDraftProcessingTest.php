<?php

use App\Jobs\ProcessShortVideo;
use App\Models\ShortVideo;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Shorts\LocalShortMedia;
use App\Services\Shorts\VideoCropper;
use App\Services\Shorts\VideoInspector;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Queue::fake();
    Storage::fake('public');
    Http::preventStrayRequests();
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    $this->mock(VideoInspector::class)->shouldReceive('inspect')->andReturn([
        'format' => 'mp4', 'codec' => 'h264', 'pixel_format' => 'yuv420p',
        'width' => 1920, 'height' => 1080, 'duration' => 20, 'bytes' => 1000,
    ]);
});

function queuedShortDraft(): ShortVideo
{
    $response = test()->postJson('/admin/short-videos/upload', [
        'video' => UploadedFile::fake()->create('source.mp4', 10, 'video/mp4'),
        'title' => 'Saved title', 'description' => 'Saved content',
    ])->assertCreated()->assertJsonPath('video.metadata.processing.status', 'queued');

    return ShortVideo::findOrFail($response->json('video.id'));
}

function runShortProcessing(ShortVideo $video): void
{
    $video->refresh();
    (new ProcessShortVideo($video->id, $video->metadata['processing']['revision']))->handle(app(VideoCropper::class), app(LocalShortMedia::class));
}

function fakeShortExport(): array
{
    Storage::disk('public')->put('shorts/edits/result.mp4', 'edited');

    return ['asset' => ['path' => 'shorts/edits/result.mp4', 'url' => '/storage/shorts/edits/result.mp4'],
        'metadata' => ['width' => 1080, 'height' => 1920, 'duration' => 20]];
}

test('saving persists the original and text without running FFmpeg and restores pending status', function () {
    $this->mock(VideoCropper::class)->shouldNotReceive('export');
    $this->mock(LocalShortMedia::class)->makePartial()->shouldNotReceive('frame');
    $video = queuedShortDraft();
    Storage::disk('public')->assertExists($video->metadata['crop_source']['path']);
    expect($video->title)->toBe('Saved title');
    expect($video->description)->toBe('Saved content');
    Queue::assertPushed(ProcessShortVideo::class, fn ($job) => $job->videoId === $video->id && $job->queue === 'default' && $job->connection !== 'sync');
    $this->get('/admin/short-videos/create?draft='.$video->id)->assertInertia(fn (Assert $page) => $page->where('draft.metadata.processing.status', 'queued'));
    $this->getJson('/admin/short-videos/'.$video->id.'/processing')->assertOk()->assertJsonPath('video.metadata.processing.status', 'queued');
    $this->postJson('/admin/short-videos/'.$video->id.'/preview', ['platforms' => ['website']])->assertUnprocessable();
    $this->postJson('/admin/short-videos/'.$video->id.'/publish', ['platforms' => ['website'], 'preview_token' => 'old'])->assertUnprocessable();
});

test('unchanged pending and ready saves reuse media without enqueueing another export', function () {
    $video = queuedShortDraft();
    $revision = $video->metadata['processing']['revision'];
    foreach (['queued', 'ready'] as $status) {
        $m = $video->fresh()->metadata;
        $m['processing']['status'] = $status;
        $video->update(['metadata' => $m]);
        $this->postJson('/admin/short-videos/'.$video->id, ['title' => 'Text only', 'description' => 'Content', 'frame_offset' => 0, 'cover_mode' => 'keep'])
            ->assertOk()->assertJsonPath('video.metadata.processing.revision', $revision);
    }
    Queue::assertPushed(ProcessShortVideo::class, 1);
});

test('background completion preserves concurrent text and photo saves and duplicate jobs are no ops', function () {
    $video = queuedShortDraft();
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->andReturnUsing(function () use ($video) {
        $this->postJson('/admin/short-videos/'.$video->id, ['title' => 'Newer title', 'description' => 'Newer content', 'frame_offset' => 0,
            'cover_mode' => 'upload', 'cover' => UploadedFile::fake()->image('cover.jpg')])->assertOk();

        return fakeShortExport();
    });
    $this->mock(LocalShortMedia::class)->makePartial()->shouldNotReceive('frame');
    runShortProcessing($video);
    runShortProcessing($video);
    $video->refresh();
    expect($video->metadata['processing']['status'])->toBe('ready');
    expect($video->metadata['cover_source'])->toBe('photo');
    expect($video->title)->toBe('Newer title');
    expect($video->description)->toBe('Newer content');
    Storage::disk('public')->assertExists($video->metadata['crop_source']['path']);
    Storage::disk('public')->assertExists(app(LocalShortMedia::class)->pathFromUrl($video->thumbnail_url));
});

test('failed processing preserves source and settings and retry creates exactly one new revision', function () {
    $video = queuedShortDraft();
    $original = $video->metadata['crop_source'];
    $revision = $video->metadata['processing']['revision'];
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->andThrow(new RuntimeException('export failed'));
    expect(fn () => runShortProcessing($video))->toThrow(RuntimeException::class);
    expect($video->fresh()->metadata['processing']['status'])->toBe('failed');
    expect($video->fresh()->metadata['crop_source'])->toBe($original);
    Storage::disk('public')->assertExists($original['path']);
    $this->postJson('/admin/short-videos/'.$video->id.'/processing/retry')->assertOk()->assertJsonPath('video.metadata.processing.status', 'queued');
    $this->postJson('/admin/short-videos/'.$video->id.'/processing/retry')->assertOk();
    expect($video->fresh()->metadata['processing']['revision'])->not->toBe($revision);
    Queue::assertPushed(ProcessShortVideo::class, 2);
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->andReturnUsing(fn () => fakeShortExport());
    $this->mock(LocalShortMedia::class)->makePartial()->shouldReceive('frame')->once()->andReturn('/storage/shorts/covers/ready.jpg');
    runShortProcessing($video);
    expect($video->fresh()->metadata['processing']['status'])->toBe('ready');
});

test('outdated export and its failure callback cannot overwrite a newer edit', function () {
    $video = queuedShortDraft();
    $oldRevision = $video->metadata['processing']['revision'];
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->andReturnUsing(function () use ($video) {
        $this->postJson('/admin/short-videos/'.$video->id.'/crop', ['expected_url' => $video->video_url,
            'mode' => 'crop', 'x' => .5, 'y' => .5, 'zoom' => 2, 'start' => 1, 'end' => 10])->assertOk();

        return fakeShortExport();
    });
    runShortProcessing($video);
    (new ProcessShortVideo($video->id, $oldRevision))->failed(new RuntimeException);
    expect($video->fresh()->metadata['processing']['status'])->toBe('queued');
    expect($video->fresh()->metadata['video_crop']['zoom'])->toBe(2);
    expect($video->fresh()->video_url)->toBe($video->video_url);
    Storage::disk('public')->assertMissing('shorts/edits/result.mp4');
});

test('frame changes run in the background without reencoding the video', function () {
    $video = queuedShortDraft();
    $m = $video->metadata;
    $m['processing']['status'] = 'ready';
    $video->update(['metadata' => $m]);
    $this->mock(VideoCropper::class)->shouldNotReceive('export');
    $this->mock(LocalShortMedia::class)->makePartial()->shouldReceive('frame')->once()->with($m['local_path'], 4.0)->andReturn('/storage/shorts/covers/frame.jpg');
    $this->postJson('/admin/short-videos/'.$video->id, ['title' => 'Title', 'frame_offset' => 4, 'cover_mode' => 'frame'])
        ->assertOk()->assertJsonPath('video.metadata.processing.status', 'queued');
    runShortProcessing($video);
    expect($video->fresh()->metadata['processing']['status'])->toBe('ready');
});

test('processing status and retries enforce draft ownership', function () {
    $video = queuedShortDraft();
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    $this->getJson('/admin/short-videos/'.$video->id.'/processing')->assertForbidden();
    $this->postJson('/admin/short-videos/'.$video->id.'/processing/retry')->assertForbidden();
});
