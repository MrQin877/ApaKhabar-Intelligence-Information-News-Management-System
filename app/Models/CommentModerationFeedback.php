<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommentModerationFeedback extends Model
{
    protected $table = 'comment_moderation_feedback';

    public $timestamps = false;

    protected $guarded = ['id'];

    protected $casts = ['created_at' => 'datetime', 'expected_revision' => 'integer'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Moderation corrections must be appended.'));
        static::deleting(fn () => throw new \LogicException('Remove feedback only through comment retention/deletion.'));
    }
}
