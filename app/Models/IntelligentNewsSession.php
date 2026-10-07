<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class IntelligentNewsSession extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'created_by', 'status', 'title', 'prompt', 'context_summary', 'current_intent',
        'last_message_at', 'selected_document_ids',
        'selected_information_ids', 'user_facts', 'pending_questions',
        'conflicts', 'clarification_rounds', 'draft_id', 'archived_at',
    ];

    protected $casts = [
        'selected_document_ids' => 'array',
        'selected_information_ids' => 'array',
        'user_facts' => 'array',
        'pending_questions' => 'array',
        'conflicts' => 'array',
        'archived_at' => 'datetime',
        'clarification_rounds' => 'integer',
        'last_message_at' => 'datetime',
    ];

    public function draft()
    {
        return $this->belongsTo(IntelligentNewsDraft::class, 'draft_id');
    }

    public function assertWritable(): void
    {
        abort_if($this->draft()->where('status', 'published')->exists(), 409,
            'Percakapan berita terbit hanya dapat dibaca. Mulai percakapan baru untuk perubahan.');
    }

    public function messages()
    {
        return $this->hasMany(IntelligentNewsMessage::class, 'session_id')->oldest();
    }

    public function runs()
    {
        return $this->hasMany(IntelligentNewsRun::class, 'session_id')->oldest();
    }
}
