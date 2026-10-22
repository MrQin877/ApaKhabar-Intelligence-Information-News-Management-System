<?php

use App\Models\ShortVideo;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Shorts\LocalShortMedia;
use App\Services\Shorts\VideoCropper;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

function cropDraft(): ShortVideo
{
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    test()->actingAs($user);

    return ShortVideo::create(['created_by' => $user->getKey(), 'title' => 'Original', 'description' => 'Keep this description',
        'video_url' => 'https://res.cloudinary.com/demo/video/upload/original.mp4', 'video_public_id' => 'original',
        'thumbnail_url' => 'https://res.cloudinary.com/demo/video/upload/so_2,f_jpg/original.jpg', 'frame_offset' => 2,
        'metadata' => ['width' => 576, 'height' => 1024, 'duration' => 12]]);
}

function cropPayload(ShortVideo $video, array $changes = []): array
{
    return array_replace(['expected_url' => $video->video_url, 'x' => 0.5, 'y' => 0.5, 'zoom' => 1, 'start' => 0, 'end' => 12], $changes);
}

beforeEach(function () {
    Storage::fake('public');
    $local = Mockery::mock(LocalShortMedia::class)->makePartial();
    $local->shouldReceive('frame')->andReturn('http://localhost/storage/shorts/covers/cropped.jpg');
    $this->app->instance(LocalShortMedia::class, $local);
});

test('unchanged crop does not export or upload', function () {
    $video = cropDraft();
    $this->mock(VideoCropper::class)->shouldNotReceive('export');
    $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video))->assertOk()->assertJsonPath('changed', false);
    expect($video->fresh()->video_public_id)->toBe('original');
});

test('crop keeps original and draft text, refreshes frame cover, and repeated saves are no-ops', function () {
    $video = cropDraft();
    $original = $video->video_url;
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->with($original, Mockery::on(fn ($edit) => $edit['zoom'] === 2.0))
        ->andReturn(['asset' => ['url' => 'http://localhost/storage/shorts/edits/cropped.mp4', 'path' => 'shorts/edits/cropped.mp4'], 'metadata' => ['width' => 1080, 'height' => 1920, 'duration' => 10, 'rotation' => 0]]);
    $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video, ['zoom' => 2, 'start' => 1, 'end' => 11]))
        ->assertOk()->assertJsonPath('video.metadata.crop_source.url', $original)->assertJsonPath('video.title', 'Original')->assertJsonPath('video.frame_offset', 1);
    $video->refresh();
    expect($video->video_url)->toContain('/storage/shorts/edits/cropped.mp4');
    expect($video->thumbnail_url)->toContain('cropped.jpg');
    $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video, ['zoom' => 2, 'start' => 1, 'end' => 11]))->assertOk()->assertJsonPath('changed', false);
    expect($video->publications()->count())->toBe(0);
});

test('subsequent crop uses the preserved original and keeps custom cover', function () {
    $video = cropDraft();
    $original = $video->video_url;
    $video->update(['video_url' => 'https://res.cloudinary.com/demo/video/upload/current.mp4', 'thumbnail_url' => 'https://res.cloudinary.com/demo/image/upload/custom.jpg',
        'metadata' => ['width' => 1080, 'height' => 1920, 'duration' => 12, 'crop_source' => ['url' => $original, 'public_id' => 'original', 'metadata' => $video->metadata],
            'video_crop' => ['x' => 0.5, 'y' => 0.5, 'zoom' => 2, 'start' => 0, 'end' => 12]]]);
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->with($original, Mockery::any())->andReturn([
        'asset' => ['url' => 'http://localhost/storage/shorts/edits/next.mp4', 'path' => 'shorts/edits/next.mp4'],
        'metadata' => ['width' => 1080, 'height' => 1920, 'duration' => 12],
    ]);
    $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video, ['zoom' => 3]))->assertOk()->assertJsonPath('video.thumbnail_url', $video->thumbnail_url);
});

test('invalid, stale, foreign and published crop requests cannot export', function () {
    $video = cropDraft();
    $this->mock(VideoCropper::class)->shouldNotReceive('export');
    foreach ([['zoom' => 5], ['x' => -1], ['end' => 14], ['start' => 4, 'end' => 3]] as $bad) {
        $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video, $bad))->assertUnprocessable();
    }
    // Authorization checks below are independent of the export rate limit.
    $this->withoutMiddleware(ThrottleRequests::class);
    $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video, ['expected_url' => 'stale']))->assertStatus(409);
    $video->update(['status' => 'published']);
    $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video))->assertUnprocessable();
    $other = User::factory()->create(['roleID' => UserRole::where('name', 'admin')->first()->getKey()]);
    $this->actingAs($other)->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video))->assertForbidden();
});

test('export failure leaves the previous asset and metadata intact', function () {
    $video = cropDraft();
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->andThrow(ValidationException::withMessages(['video' => 'Export failed']));
    $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video, ['zoom' => 2]))->assertUnprocessable();
    expect($video->fresh()->video_url)->toBe($video->video_url);
    expect($video->fresh()->metadata)->toBe($video->metadata);
});

test('a draft published during export cannot have its media replaced', function () {
    $video = cropDraft();
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->andReturnUsing(function () use ($video) {
        $video->update(['status' => 'published']);
        Storage::disk('public')->put('shorts/edits/new.mp4', 'abandoned');

        return ['asset' => ['url' => 'http://localhost/storage/shorts/edits/new.mp4', 'path' => 'shorts/edits/new.mp4'], 'metadata' => ['width' => 1080, 'height' => 1920, 'duration' => 12]];
    });
    $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video, ['zoom' => 2]))->assertStatus(409);
    expect($video->fresh()->video_public_id)->toBe('original');
    Storage::disk('public')->assertMissing('shorts/edits/new.mp4');
});

test('crop rectangle remains exact 9 by 16 and inside source at every edge', function () {
    foreach ([[1920, 1080], [576, 1024], [1080, 1080]] as [$w, $h]) {
        foreach ([1, 1.75, 4] as $zoom) {
            foreach ([0, 0.5, 1] as $position) {
                $r = VideoCropper::rectangle($w, $h, ['zoom' => $zoom, 'x' => $position, 'y' => $position]);
                expect($r['width'] * 16)->toBe($r['height'] * 9);
                expect($r['x'] + $r['width'])->toBeLessThanOrEqual($w);
                expect($r['y'] + $r['height'])->toBeLessThanOrEqual($h);
            }
        }
    }
});

test('real FFmpeg crop export is portrait, unrotated, playable and trimmed', function () {
    $binary = config('shorts.ffmpeg') ?: preg_replace('/ffprobe(\.exe)?$/i', 'ffmpeg$1', config('shorts.ffprobe'));
    $probe = new Process([$binary, '-version']);
    try {
        $probe->mustRun();
    } catch (Throwable) {
        $this->markTestSkipped('FFmpeg is required for media integration test.');
    }
    $fixture = tempnam(sys_get_temp_dir(), 'crop-fixture-');
    try {
        (new Process([$binary, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mp4', $fixture]))->mustRun();
        config(['services.cloudinary.cloud_name' => 'demo']);
        Http::fake(fn () => Http::response(file_get_contents($fixture), 200));
        $local = new LocalShortMedia;
        $this->app->instance(LocalShortMedia::class, $local);
        $result = app(VideoCropper::class)->export('https://res.cloudinary.com/demo/video/upload/source.mp4', ['x' => 1, 'y' => 0.5, 'zoom' => 1.5, 'start' => 0.5, 'end' => 1.5]);
        expect($result['metadata']['codec'])->toBe('h264');
        expect($result['metadata']['width'])->toBe(1080);
        expect($result['metadata']['height'])->toBe(1920);
        expect($result['metadata']['rotation'])->toBe(0);
        expect($result['metadata']['sample_aspect_ratio'])->toEqual(1);
        expect($result['metadata']['duration'])->toBeGreaterThanOrEqual(0.9)->toBeLessThanOrEqual(1.1);
        Storage::disk('public')->assertExists($result['asset']['path']);
        $frame = $local->frame($result['asset']['path'], 0.2);
        Storage::disk('public')->assertExists($local->pathFromUrl($frame));
    } finally {
        unlink($fixture);
    }
});
