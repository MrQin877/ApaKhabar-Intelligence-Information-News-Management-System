<?php

namespace App\Services\News;

class CommentModeration
{
    public function check(string $content): array
    {
        // Reports and admin decisions handle review after publication.
        return [
            'status' => 'published',
            'ai_flagged' => null,
            'moderation_categories' => [],
            'moderation_reason' => 'manual_moderation',
        ];
    }
}
