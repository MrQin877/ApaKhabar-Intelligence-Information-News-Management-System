<?php

return [
    'ffprobe' => env('FFPROBE_BINARY', 'ffprobe'),
    'ffmpeg' => env('FFMPEG_BINARY'), // Defaults to ffmpeg beside the configured ffprobe binary.
    'crop_timeout' => 300,
    'max_upload_kb' => 102400,
    'queue' => 'video-publishing',
    'poll_seconds' => 30,
    'permalink_attempts' => 10,
];
