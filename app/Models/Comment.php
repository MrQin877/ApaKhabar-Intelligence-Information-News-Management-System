<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Comment extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'comments';

    protected $fillable = [
        'news_id',
        'user_id',
        'content',
        'likes',
        'parent_id',   // null = top-level, set = reply
    ];

    protected $attributes = [
        'likes'     => 0,
        'parent_id' => null,
    ];

    // Replies are comments with this comment's id as parent_id
    public function replies()
    {
        return $this->hasMany(Comment::class, 'parent_id');
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}