<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligenceInformation extends Model
{
    protected $table = 'intelligence_information';

    protected $fillable = [
        'document_id', 'item_index', 'type', 'title', 'summary', 'labels',
        'fields', 'evidence', 'confidence', 'search_text', 'is_active',
    ];

    protected $casts = [
        'labels' => 'array', 'fields' => 'array', 'evidence' => 'array',
        'confidence' => 'float', 'is_active' => 'boolean',
    ];

    public function document()
    {
        return $this->belongsTo(IntelligenceDocument::class, 'document_id');
    }
}
