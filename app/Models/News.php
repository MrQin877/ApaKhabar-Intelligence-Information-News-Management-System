<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use MongoDB\Laravel\Eloquent\Model;

class News extends Model
{
    use HasFactory;

    protected $connection = 'mongodb';
    protected $collection = 'news';

    protected $fillable = [
        'title',
        'content',
        'excerpt',
        'image',
        'category',
        'date',
        'views',
        'likes_count',
    ];

    protected $attributes = [
        'views'       => 0,
        'likes_count' => 0,
    ];

    public function comments()
    {
        return $this->hasMany(Comment::class, 'news_id');
    }

    public function likes()
    {
        return $this->hasMany(Like::class, 'news_id');
    }
}