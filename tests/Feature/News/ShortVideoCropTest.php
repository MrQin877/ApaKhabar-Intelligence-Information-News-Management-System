<?php

use App\Jobs\ProcessShortVideo;
use App\Models\ShortVideo;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Shorts\LocalShortMedia;
use App\Services\Shorts\VideoCropper;
use App\Services\Shorts\VideoInspector;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

function finishCropDraft(ShortVideo $video): void
{
    $v = $video->fresh();
    (new ProcessShortVideo($v->id, $v->metadata['processing']['revision']))->handle(app(VideoCropper::class), app(LocalShortMedia::class));
}

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
    Queue::fake();
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
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->with($original, Mockery::on(fn ($edit) => (float) $edit['zoom'] === 2.0))
        ->andReturn(['asset' => ['url' => 'http://localhost/storage/shorts/edits/cropped.mp4', 'path' => 'shorts/edits/cropped.mp4'], 'metadata' => ['width' => 1080, 'height' => 1920, 'duration' => 10, 'rotation' => 0]]);
    $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video, ['zoom' => 2, 'start' => 1, 'end' => 11]))
        ->assertOk()->assertJsonPath('video.metadata.crop_source.url', $original)->assertJsonPath('video.title', 'Original')->assertJsonPath('video.frame_offset', 1);
    finishCropDraft($video);
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
    finishCropDraft($video);
    expect($video->fresh()->thumbnail_url)->toBe($video->thumbnail_url);
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

test('export failure preserves the previous asset and saved editing settings', function () {
    $video = cropDraft();
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->andThrow(ValidationException::withMessages(['video' => 'Export failed']));
    $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video, ['zoom' => 2]))->assertOk();
    expect(fn () => finishCropDraft($video))->toThrow(ValidationException::class);
    expect($video->fresh()->video_url)->toBe($video->video_url);
    expect($video->fresh()->metadata['processing']['status'])->toBe('failed');
    expect($video->fresh()->metadata['video_crop']['zoom'])->toBe(2);
});

test('a draft published during export cannot have its media replaced', function () {
    $video = cropDraft();
    $this->mock(VideoCropper::class)->shouldReceive('export')->once()->andReturnUsing(function () use ($video) {
        $video->update(['status' => 'published']);
        Storage::disk('public')->put('shorts/edits/new.mp4', 'abandoned');

        return ['asset' => ['url' => 'http://localhost/storage/shorts/edits/new.mp4', 'path' => 'shorts/edits/new.mp4'], 'metadata' => ['width' => 1080, 'height' => 1920, 'duration' => 12]];
    });
    $this->postJson('/admin/short-videos/'.$video->id.'/crop', cropPayload($video, ['zoom' => 2]))->assertOk();
    finishCropDraft($video);
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
        expect($result['metadata']['width'])->toBe(540);
        expect($result['metadata']['height'])->toBe(960);
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

test('real Fit and Crop bake display matrices into upright pixels and keep audio', function ($rotation, $mode, $width = 320, $height = 180) {
    $binary = config('shorts.ffmpeg') ?: preg_replace('/ffprobe(\.exe)?$/i', 'ffmpeg$1', config('shorts.ffprobe'));
    try {
        (new Process([$binary, '-version']))->mustRun();
    } catch (Throwable) {
        $this->markTestSkipped('FFmpeg is required for media integration test.');
    }
    $fixture = tempnam(sys_get_temp_dir(), 'fit-source-');
    $rotated = tempnam(sys_get_temp_dir(), 'fit-rotated-');
    try {
        (new Process([$binary, '-v', 'error', '-y', '-f', 'lavfi', '-i', "testsrc2=size={$width}x{$height}:rate=30", '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '0.4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-f', 'mp4', $fixture]))->mustRun();
        (new Process([$binary, '-v', 'error', '-y', '-display_rotation', (string) $rotation, '-i', $fixture, '-c', 'copy', '-f', 'mp4', $rotated]))->mustRun();
        $local = new LocalShortMedia;
        $this->app->instance(LocalShortMedia::class, $local);
        $file = new UploadedFile($rotated, 'rotated.mp4', 'video/mp4', null, true);
        $inspector = app(VideoInspector::class);
        $source = $inspector->inspect($file, true);
        expect(($source['rotation'] % 360 + 360) % 360)->toBe(($rotation % 360 + 360) % 360);
        $stored = $local->store($file);
        $result = app(VideoCropper::class)->export($stored['url'], ['mode' => $mode, 'x' => 0.5, 'y' => 0.5, 'zoom' => 1, 'start' => 0, 'end' => 0.4], $stored['path']);
        expect($result['metadata']['width'])->toBe(540);
        expect($result['metadata']['height'])->toBe(960);
        expect($result['metadata']['rotation'])->toBe(0);
        expect($result['metadata']['audio_codec'])->toBe('aac');
        Storage::disk('public')->assertExists($stored['path']);
        // Compare the centre pixel grid to FFmpeg's independently autorotated source.
        $expected = new Process([$binary, '-v', 'error', '-i', $rotated, '-frames:v', '1', '-vf', 'scale=9:16', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
        $actual = new Process([$binary, '-v', 'error', '-i', $local->file($result['asset']['path'])->getRealPath(), '-frames:v', '1', '-vf', 'scale=9:16', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
        if ($mode === 'fit' && abs($rotation) % 180 === 90) {
            $expected->mustRun();
            $actual->mustRun();
            $a = array_values(unpack('C*', $expected->getOutput()));
            $b = array_values(unpack('C*', $actual->getOutput()));
            $error = array_sum(array_map(fn ($x, $y) => abs($x - $y), $a, $b)) / count($a);
            expect($error)->toBeLessThan(15);
        }
    } finally {
        @unlink($fixture);
        @unlink($rotated);
    }
})->with([[90, 'fit'], [-90, 'fit'], [180, 'fit'], [270, 'crop'], [0, 'fit'], [0, 'fit', 180, 320], [0, 'fit', 180, 180]]);
