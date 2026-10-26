<?php

use App\Services\Shorts\LocalShortMedia;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('new local short URLs deliver byte ranges and keep the original file intact', function () {
    Storage::fake('public');
    $source = UploadedFile::fake()->createWithContent('source.mp4', str_repeat('0123456789', 200));
    $asset = app(LocalShortMedia::class)->store($source);
    $path = parse_url($asset['url'], PHP_URL_PATH);

    expect($path)->toStartWith('/short-media/original/');
    expect(Storage::disk('public')->get($asset['path']))->toBe(str_repeat('0123456789', 200));
    $this->withHeader('Range', 'bytes=10-19')->get($path)
        ->assertStatus(206)
        ->assertHeader('Content-Range', 'bytes 10-19/2000')
        ->assertHeader('Accept-Ranges', 'bytes');
    expect(Storage::disk('public')->get($asset['path']))->toBe(str_repeat('0123456789', 200));

    $this->get('/short-media/original/not-a-video.mp4')->assertNotFound();
});
