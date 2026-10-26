<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShortVideoPublication extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['credential'];

    protected $appends = ['can_retry'];

    public function getCanRetryAttribute(): bool
    {
        return in_array($this->platform, ['instagram', 'facebook'])
            && $this->status === 'failed' && $this->account_id && ! $this->media_id
            && ! str_ends_with($this->stage, '_inflight')
            && (! $this->locked_until || $this->locked_until->isPast());
    }

    protected $casts = ['locked_until' => 'datetime', 'credential' => 'encrypted', 'credential_expires_at' => 'datetime', 'published_at' => 'datetime', 'next_attempt_at' => 'datetime'];

    public function video()
    {
        return $this->belongsTo(ShortVideo::class, 'short_video_id')->withTrashed();
    }
}
