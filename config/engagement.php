<?php

return [
    'anonymous_retention_days' => max(1, (int) env('ENGAGEMENT_ANONYMOUS_RETENTION_DAYS', 90)),
    'visit_retention_days' => 2,
    'report_categories' => [
        'Penipuan / Scam', 'Pelecehan / Penghinaan', 'Ujaran Kebencian',
        'Ancaman / Intimidasi', 'Spam', 'Konten Tidak Pantas', 'Lainnya',
    ],
    'admin_flag_categories' => [
        'harassment', 'indirect_insult', 'threat_intimidation', 'hate_speech', 'spam', 'other',
    ],
];
