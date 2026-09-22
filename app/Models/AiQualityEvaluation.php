<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiQualityEvaluation extends Model
{
    protected $fillable = [
        'draft_id', 'draft_version_id', 'evaluation_version', 'evaluator_model',
        'overall_score', 'quality_label', 'publish_blocked', 'dimensions',
        'claim_checks', 'warnings',
    ];

    protected $casts = [
        'overall_score' => 'float',
        'publish_blocked' => 'boolean',
        'dimensions' => 'array',
        'claim_checks' => 'array',
        'warnings' => 'array',
    ];
}
