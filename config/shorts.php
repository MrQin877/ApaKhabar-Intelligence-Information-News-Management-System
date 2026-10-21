<?php

return [
    'ffprobe' => env('FFPROBE_BINARY', 'ffprobe'),
    'max_upload_kb' => 102400,
    'queue' => 'video-publishing',
    'poll_seconds' => 30,
];
