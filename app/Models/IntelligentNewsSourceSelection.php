<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligentNewsSourceSelection extends Model
{
    protected $fillable = [
        'session_id', 'message_id', 'run_id', 'source_type', 'information_id',
        'document_id', 'url', 'title', 'source_snapshot', 'decision', 'decided_by',
        'decided_at',
    ];

    protected $casts = [
        'source_snapshot' => 'array',
        'decided_at' => 'datetime',
    ];
}
