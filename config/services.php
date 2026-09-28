<?php

return [
    'facebook' => [
        'page_id' => env('FACEBOOK_PAGE_ID'),
        'page_access_token' => env('FACEBOOK_PAGE_ACCESS_TOKEN'),
        'graph_version' => env('FACEBOOK_GRAPH_VERSION', 'v26.0'),
    ],
    'cloudinary' => [
        'cloud_name' => env('CLOUDINARY_CLOUD_NAME'),
        'api_key' => env('CLOUDINARY_API_KEY'),
        'api_secret' => env('CLOUDINARY_API_SECRET'),
    ],
    'instagram' => [
        'user_id' => env('INSTAGRAM_USER_ID'),
        'access_token' => env('INSTAGRAM_ACCESS_TOKEN'),
        'graph_version' => env('META_GRAPH_VERSION', 'v25.0'),
    ],
    'apakhabar_ai' => [
        'url' => env('APAKHABAR_AI_URL', 'http://127.0.0.1:8001'),
        'timeout' => (int) env('APAKHABAR_AI_TIMEOUT', 180),
        'connect_timeout' => (int) env('APAKHABAR_AI_CONNECT_TIMEOUT', 5),
    ],

    'mobile' => [
        'password_reset_return_url' => env('MOBILE_PASSWORD_RESET_RETURN_URL', 'apakhabarmobileapp:///reset-password'),
        'verification_return_url' => env('MOBILE_VERIFICATION_RETURN_URL', 'apakhabarmobileapp:///verify-email'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],
    /*
    'twilio' => [
        'sid'            => env('TWILIO_SID'),
        'token'          => env('TWILIO_TOKEN'),
        'from'           => env('TWILIO_FROM'),
        'whatsapp_from'  => env('TWILIO_WHATSAPP_FROM'),
    ],

    'vonage' => [
        'key'    => env('VONAGE_KEY'),
        'secret' => env('VONAGE_SECRET'),
        'sms_from'   => env('VONAGE_SMS_FROM'),
    ],
    */
    'bulk360' => [
        'app_key' => env('BULK360_APP_KEY'),
        'app_secret' => env('BULK360_APP_SECRET'),
        'from' => env('BULK360_FROM', '68068'),
    ],

    'whapi' => [
        'token' => env('WHAPI_TOKEN'),
        'villager_group' => env('WHAPI_VILLAGER_GROUP'),
        'employee_group' => env('WHAPI_EMPLOYEE_GROUP'),
    ],

];
