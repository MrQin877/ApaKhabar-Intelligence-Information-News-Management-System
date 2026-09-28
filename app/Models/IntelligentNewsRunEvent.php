<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligentNewsRunEvent extends Model
{
    protected $fillable = [
        'run_id', 'sequence', 'event_type', 'tool_name', 'label', 'content', 'payload',
    ];

    protected $casts = ['payload' => 'array'];
}
