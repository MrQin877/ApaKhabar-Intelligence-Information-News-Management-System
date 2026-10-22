<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Like extends Model
{
    public const UPDATED_AT = null;

    protected $primaryKey = 'likeID';

    protected $fillable = [
        'postID',
        'userID',
    ];

    public function news()
    {
        return $this->belongsTo(News::class, 'postID', 'postID');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'userID', 'userID');
    }
}
