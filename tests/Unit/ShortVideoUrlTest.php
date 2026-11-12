<?php

use App\Models\ShortVideo;

uses(Tests\TestCase::class);

it('resolves saved local shorts URLs against the active application origin', function () {
    config(['app.url' => 'http://localhost:8088']);
    $video = new ShortVideo([
        'thumbnail_url' => 'http://localhost:8000/storage/shorts/covers/test.jpg',
        'video_url' => 'http://localhost:8000/storage/shorts/videos/test.mp4',
        'metadata' => ['cover_original' => 'http://localhost:8000/storage/shorts/covers/original.jpg'],
    ]);
    expect($video->thumbnail_url)->toBe('http://localhost:8088/storage/shorts/covers/test.jpg')
        ->and($video->video_url)->toBe('http://localhost:8088/storage/shorts/videos/test.mp4')
        ->and($video->toArray()['metadata']['cover_original'])->toBe('http://localhost:8088/storage/shorts/covers/original.jpg')
        ->and($video->getAttributes()['thumbnail_url'])->toBe('http://localhost:8000/storage/shorts/covers/test.jpg');
});

it('preserves remote shorts URLs and follows local composer development configuration', function () {
    config(['app.url' => 'http://localhost:8000']);
    $video = new ShortVideo(['thumbnail_url' => 'https://res.cloudinary.com/example/test.jpg',
        'video_url' => '/storage/shorts/videos/test.mp4']);
    expect($video->thumbnail_url)->toBe('https://res.cloudinary.com/example/test.jpg')
        ->and($video->video_url)->toBe('http://localhost:8000/storage/shorts/videos/test.mp4');
});
