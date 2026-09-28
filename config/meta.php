<?php

return [
    'instagram_discovery_diagnostics' => env('META_INSTAGRAM_DISCOVERY_DIAGNOSTICS', false),
    'graph_version' => env('META_GRAPH_VERSION', 'v25.0'),
    'facebook' => [
        'app_id' => env('FACEBOOK_APP_ID'),
        'redirect_uri' => env('FACEBOOK_REDIRECT_URI'),
        'app_secret' => env('FACEBOOK_APP_SECRET'),
    ],
    // Separate Business Login configurations preserve each platform's permission set.
    'login_config_ids' => [
        'facebook' => env('FACEBOOK_LOGIN_CONFIG_ID'),
        'instagram' => env('INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID'),
    ],
];
