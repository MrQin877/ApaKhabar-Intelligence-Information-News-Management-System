<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligentNewsRun extends Model
{
    protected $fillable = [
        'session_id', 'user_message_id', 'intent', 'status', 'current_stage',
        'error_message', 'started_at', 'completed_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function events()
    {
        return $this->hasMany(IntelligentNewsRunEvent::class, 'run_id')->orderBy('sequence');
    }

    public function session()
    {
        return $this->belongsTo(IntelligentNewsSession::class, 'session_id');
    }
}
