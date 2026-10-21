<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShortVideoPublication extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['credential'];

    protected $casts = ['locked_until' => 'datetime', 'credential' => 'encrypted', 'credential_expires_at' => 'datetime', 'published_at' => 'datetime', 'next_attempt_at' => 'datetime'];

    public function video()
    {
        return $this->belongsTo(ShortVideo::class, 'short_video_id')->withTrashed();
    }
}
