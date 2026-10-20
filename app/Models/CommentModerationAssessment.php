<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class CommentModerationAssessment extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected $casts = [
        'ai_flagged' => 'boolean', 'categories' => 'array', 'category_scores' => 'array',
        'assessed_at' => 'datetime', 'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Original moderation assessments are immutable.'));
        static::deleting(fn () => throw new \LogicException('Remove assessments only through comment retention/deletion.'));
    }

    // Call while creating the comment or holding its row lock. Legacy metadata is not invented.
    public static function capture(Comment $comment, ?array $metadata = null): self
    {
        $initialHistory = $metadata === null
            ? DB::table('comment_moderation_history')
                ->where('comment_id', $comment->getKey())->whereNull('from_status')->orderBy('id')->first()
            : null;

        return static::firstOrCreate(['comment_id' => $comment->getKey()], [
            'classification' => $comment->ai_flagged === null ? 'unknown' : ($comment->ai_flagged ? 'flagged' : 'not_flagged'),
            'ai_flagged' => $comment->ai_flagged,
            'categories' => $comment->moderation_categories,
            'category_scores' => $metadata['category_scores'] ?? null,
            'reason' => $comment->moderation_reason,
            'initial_status' => $metadata !== null ? $comment->status : ($initialHistory->to_status ?? null),
            'requested_model' => $metadata['requested_model'] ?? null,
            'returned_model' => $metadata['returned_model'] ?? null,
            'source' => $metadata !== null ? 'submission' : 'legacy_snapshot',
            'assessed_at' => $metadata !== null ? now() : null,
            'created_at' => now(),
        ]);
    }
}
