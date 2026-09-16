<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligenceDocument extends Model
{
    protected $fillable = [
        'uploaded_by', 'ai_document_id', 'original_name', 'storage_disk', 'storage_path',
        'mime_type', 'file_size', 'sha256', 'status', 'character_count',
        'embedding_status', 'error_message', 'processed_at',
    ];

    protected $casts = ['processed_at' => 'datetime'];

    public function information()
    {
        return $this->hasMany(IntelligenceInformation::class, 'document_id');
    }
}
