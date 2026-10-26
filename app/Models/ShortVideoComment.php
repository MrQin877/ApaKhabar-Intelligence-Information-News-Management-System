<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class ShortVideoComment extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['submission_hash', 'moderation_categories', 'moderation_reason'];

    protected $casts = ['ai_flagged' => 'boolean', 'moderation_categories' => 'array', 'moderation_revision' => 'integer'];

    public function scopeAwaitingReview($query)
    {
        return $query->where(function ($pending) {
            $pending->where('status', 'pending_review')
                ->orWhereIn('id', DB::table('short_video_comment_reports')->whereNull('resolved_at')->select('comment_id'))
                ->orWhereIn('id', DB::table('short_video_comment_flags')->whereNull('resolved_at')->select('comment_id'));
        });
    }

    public function video()
    {
        return $this->belongsTo(ShortVideo::class, 'short_video_id');
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'user_id', 'userID');
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function replies()
    {
        return $this->hasMany(self::class, 'root_id');
    }

    public function likes()
    {
        return $this->belongsToMany(User::class, 'short_video_comment_likes', 'comment_id', 'user_id');
    }
}
