<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Comment extends Model
{
    protected $primaryKey = 'commentID';

    protected $fillable = [
        'newsID',
        'userID',
        'content',
        'parentID', 'guest_name', 'status', 'ai_flagged', 'moderation_categories',
        'moderation_reason', 'moderator_id', 'moderated_at', 'submission_hash',
    ];

    protected $attributes = [
        'parentID' => null,
    ];

    protected $hidden = ['moderation_categories', 'moderation_reason', 'ai_flagged', 'submission_hash', 'moderator_id'];

    protected $casts = ['moderation_revision' => 'integer', 'moderation_categories' => 'array', 'ai_flagged' => 'boolean'];

    public function scopeAwaitingReview($query)
    {
        return $query->where(function ($pending) {
            $pending->where('status', 'pending_review')
                ->orWhere(function ($reported) {
                    $reported->where('status', 'published')->whereIn('commentID',
                        DB::table('comment_reports')->whereNull('resolved_at')->select('comment_id'));
                })
                ->orWhere(function ($flagged) {
                    // An article-side admin correction hides immediately, then awaits queue review.
                    $flagged->where('status', 'removed')->whereExists(function ($feedback) {
                        $feedback->selectRaw('1')->from('comment_moderation_feedback as feedback')
                            ->whereColumn('feedback.comment_id', 'comments.commentID')
                            ->where('feedback.classification', 'inappropriate')
                            ->whereNotExists(function ($newer) {
                                $newer->selectRaw('1')->from('comment_moderation_history as newer')
                                    ->whereColumn('newer.comment_id', 'comments.commentID')
                                    ->whereColumn('newer.id', '>', 'feedback.history_id');
                            });
                    });
                });
        });
    }

    public function likes()
    {
        return $this->belongsToMany(User::class, 'comment_likes', 'comment_id', 'user_id');
    }

    public function reporters()
    {
        return $this->belongsToMany(User::class, 'comment_reports', 'comment_id', 'user_id');
    }

    public function replies()
    {
        return $this->hasMany(Comment::class, 'parentID', 'commentID');
    }

    public function parent()
    {
        return $this->belongsTo(Comment::class, 'parentID', 'commentID');
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'userID', 'userID');
    }

    public function news()
    {
        return $this->belongsTo(News::class, 'newsID', 'postID');
    }
}
