<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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

    protected $casts = ['moderation_categories' => 'array', 'ai_flagged' => 'boolean'];

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
