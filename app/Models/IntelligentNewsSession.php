<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligentNewsSession extends Model
{
    protected $fillable = [
        'created_by', 'status', 'prompt', 'selected_document_ids',
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
    ];

    public function messages()
    {
        return $this->hasMany(IntelligentNewsMessage::class, 'session_id')->oldest();
    }
}
