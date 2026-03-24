<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Like extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'likes';

    protected $fillable = [
        'news_id',
        'user_id',
    ];
}