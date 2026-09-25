<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligentNewsDraft extends Model
{
    protected $fillable = [
        'created_by', 'creation_method', 'category_id', 'image',
        'headline', 'subheadline', 'lead', 'body', 'summary',
        'labels', 'sources_used', 'warnings', 'user_prompt', 'status',
        'published_news_id', 'instagram_media_id', 'version', 'reviewed_at',
        'show_on_homepage',
    ];

    protected $casts = [
        'body' => 'array', 'labels' => 'array', 'sources_used' => 'array',
        'warnings' => 'array',
        'reviewed_at' => 'datetime',
        'show_on_homepage' => 'boolean',
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

    public function session()
    {
        return $this->hasOne(IntelligentNewsSession::class, 'draft_id');
    }

    public function category()
    {
        return $this->belongsTo(NewsCategory::class, 'category_id', 'categoryID');
    }

    public function versions()
    {
        return $this->hasMany(IntelligentNewsDraftVersion::class, 'draft_id')->orderByDesc('version');
    }

    public function qualityEvaluations()
    {
        return $this->hasMany(AiQualityEvaluation::class, 'draft_id')->latest();
    }
}
