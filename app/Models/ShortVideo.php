<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ShortVideo extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected $casts = ['metadata' => 'array', 'published_at' => 'datetime', 'frame_offset' => 'float', 'view_count' => 'integer', 'likes_count' => 'integer'];

    public function comments()
    {
        return $this->hasMany(ShortVideoComment::class);
    }

    public function publications()
    {
        return $this->hasMany(ShortVideoPublication::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'userID');
    }
}
