<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class IntelligenceDocument extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'uploaded_by', 'ai_document_id', 'original_name', 'storage_disk', 'storage_path',
        'mime_type', 'file_size', 'sha256', 'status', 'character_count',
        'embedding_status', 'error_message', 'processed_at',
        'processing_attempts', 'last_attempted_at', 'archive_after', 'archived_at',
    ];

    protected $casts = [
        'processed_at' => 'datetime',
        'last_attempted_at' => 'datetime',
        'archive_after' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function information()
    {
        return $this->hasMany(IntelligenceInformation::class, 'document_id');
    }

    public function extractionRequests()
    {
        return $this->hasMany(IntelligenceExtractionRequest::class, 'document_id');
    }
}
