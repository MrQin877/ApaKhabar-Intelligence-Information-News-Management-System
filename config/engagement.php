<?php

return [
    'openai_key' => env('OPENAI_API_KEY'),
    'moderation_timeout' => 8,
    'anonymous_retention_days' => max(1, (int) env('ENGAGEMENT_ANONYMOUS_RETENTION_DAYS', 90)),
    'visit_retention_days' => 2,
];
