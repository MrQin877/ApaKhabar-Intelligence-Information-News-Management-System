<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligentNewsMessage extends Model
{
    protected $fillable = [
        'session_id', 'reply_to_id', 'role', 'status', 'sequence', 'intent',
        'content', 'tool_name', 'payload',
        'draft_version_id',
    ];

    protected $casts = ['payload' => 'array'];

    protected static function booted(): void
    {
        static::creating(function (IntelligentNewsMessage $message) {
            if (! $message->sequence) {
                $message->sequence = (int) static::query()
                    ->where('session_id', $message->session_id)
                    ->max('sequence') + 1;
            }
        });

        static::created(function (IntelligentNewsMessage $message) {
            $message->session()->update(['last_message_at' => $message->created_at ?? now()]);
        });
    }

    public function session()
    {
        return $this->belongsTo(IntelligentNewsSession::class, 'session_id');
    }
}
