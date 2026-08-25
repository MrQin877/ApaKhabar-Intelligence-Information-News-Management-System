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
        'parentID',
    ];

    protected $attributes = [
        'parentID' => null,
    ];

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