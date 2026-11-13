<?php

return [
    'url' => env('LIBRETRANSLATE_URL', 'http://127.0.0.1:5005'),
    'api_key' => env('LIBRETRANSLATE_API_KEY'),
    'timeout' => (int) env('LIBRETRANSLATE_TIMEOUT', 45),
    'lock_wait' => (int) env('LIBRETRANSLATE_LOCK_WAIT', 50),
    'cache_store' => env('TRANSLATION_CACHE_STORE', 'file'),
    'cache_seconds' => 604800,
];
