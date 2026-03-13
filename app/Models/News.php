<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model; // THIS is important

class News extends Model
{
    // Use the MongoDB connection
    protected $connection = 'mongodb';

    // Collection name
    protected $collection = 'news';

    // Mass assignable fields
    protected $fillable = ['title', 'content'];
}