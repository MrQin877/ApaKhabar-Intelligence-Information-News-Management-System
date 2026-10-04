<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiQualityEvaluation extends Model
{
    protected $fillable = [
        'draft_id', 'draft_version_id', 'evaluation_version', 'evaluator_model',
        'overall_score', 'quality_label', 'publish_blocked', 'dimensions',
        'claim_checks', 'warnings', 'approved_by', 'approved_at', 'approval_note', 'approved_version',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'approved_version' => 'integer',
        'overall_score' => 'float',
        'publish_blocked' => 'boolean',
        'dimensions' => 'array',
        'claim_checks' => 'array',
        'warnings' => 'array',
    ];

    public function getPublishBlockedAttribute($value): bool
    {
        if (! $value) {
            return false;
        }
        if ($this->approved_by && $this->approved_version !== null) {
            return IntelligentNewsDraft::whereKey($this->draft_id)->value('version') != $this->approved_version;
        }

        return true;
    }

    public function canApproveConflict(): bool
    {
        $safety = $this->dimensions['safety'] ?? 0;
        $safety = is_array($safety) ? ($safety['score'] ?? 0) : $safety;
        if (! $this->publish_blocked || $safety < 70 || in_array($this->quality_label, ['evaluation_pending', 'evaluation_unavailable'])) {
            return false;
        }

        return (bool) preg_match('/conflict|contradict|konflik|bertentangan|perbedaan|berbeda/iu', json_encode([$this->warnings, $this->claim_checks]));
    }
}
