<?php

use App\Jobs\PublishShortVideo;
use App\Models\ShortVideoPublication;

uses(Tests\TestCase::class);

test('Meta transitions poll promptly then back off without retrying errors aggressively', function () {
    config(['shorts.poll_seconds' => 30]);
    $publication = new ShortVideoPublication(['platform' => 'facebook', 'status' => 'processing', 'stage' => 'upload', 'polls' => 1]);
    expect(PublishShortVideo::pollDelaySeconds($publication))->toBe(1);
    $publication->stage = 'finish';
    expect(PublishShortVideo::pollDelaySeconds($publication))->toBe(1);
    $publication->stage = 'wait';
    expect(PublishShortVideo::pollDelaySeconds($publication))->toBe(5);
    $publication->polls = 4;
    expect(PublishShortVideo::pollDelaySeconds($publication))->toBe(15);
    $publication->polls = 20;
    expect(PublishShortVideo::pollDelaySeconds($publication))->toBe(30);
    $publication->error_summary = 'Meta belum tersedia';
    expect(PublishShortVideo::pollDelaySeconds($publication))->toBe(30);
    $publication->error_summary = null;
    $publication->platform = 'instagram';
    $publication->polls = 2;
    expect(PublishShortVideo::pollDelaySeconds($publication))->toBe(5);
    $publication->status = 'published';
    $publication->stage = 'permalink';
    expect(PublishShortVideo::pollDelaySeconds($publication))->toBe(20);
});
