<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligenceExtractionRequest extends Model
{
    protected $fillable = [
        'document_id', 'requested_by', 'mode', 'original_prompt', 'normalized_query',
        'keywords', 'model_name', 'prompt_version', 'status', 'error_message',
        'started_at', 'completed_at',
    ];

    protected $casts = [
        'keywords' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function document()
    {
        return $this->belongsTo(IntelligenceDocument::class, 'document_id');
    }

    public function information()
    {
        return $this->hasMany(IntelligenceInformation::class, 'extraction_request_id');
    }
}
