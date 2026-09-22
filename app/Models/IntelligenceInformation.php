<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligenceInformation extends Model
{
    protected $table = 'intelligence_information';

    protected $fillable = [
        'document_id', 'extraction_request_id', 'item_index', 'type', 'title',
        'summary', 'labels', 'fields', 'evidence', 'confidence', 'review_status',
        'quality_score', 'quality_breakdown', 'information_embedding_status',
        'search_text', 'is_active', 'reviewed_by', 'reviewed_at',
    ];

    protected $casts = [
        'labels' => 'array', 'fields' => 'array', 'evidence' => 'array',
        'confidence' => 'float', 'quality_score' => 'float',
        'quality_breakdown' => 'array', 'is_active' => 'boolean',
        'reviewed_at' => 'datetime',
    ];

    public function document()
    {
        return $this->belongsTo(IntelligenceDocument::class, 'document_id');
    }

    public function extractionRequest()
    {
        return $this->belongsTo(IntelligenceExtractionRequest::class, 'extraction_request_id');
    }
}
