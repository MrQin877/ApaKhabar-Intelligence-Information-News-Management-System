<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligentNewsDraft extends Model
{
    protected $fillable = [
        'created_by', 'headline', 'subheadline', 'lead', 'body', 'summary',
        'labels', 'sources_used', 'warnings', 'user_prompt', 'status',
        'published_news_id',
    ];

    protected $casts = [
        'body' => 'array', 'labels' => 'array', 'sources_used' => 'array',
        'warnings' => 'array',
    ];

    public function informationSources()
    {
        return $this->belongsToMany(
            IntelligenceInformation::class,
            'intelligent_news_draft_sources',
            'draft_id',
            'information_id'
        )->withTimestamps();
    }
}
