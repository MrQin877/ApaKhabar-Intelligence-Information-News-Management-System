<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligentNewsMessage extends Model
{
    protected $fillable = [
        'session_id', 'role', 'intent', 'content', 'tool_name', 'payload',
        'draft_version_id',
    ];

    protected $casts = ['payload' => 'array'];

    public function session()
    {
        return $this->belongsTo(IntelligentNewsSession::class, 'session_id');
    }
}
