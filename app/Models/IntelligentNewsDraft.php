<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligentNewsDraft extends Model
{
    protected $fillable = [
        'created_by', 'creation_method', 'category_id', 'image',
        'title', 'content', 'excerpt',
        'labels', 'sources_used', 'warnings', 'user_prompt', 'status',
        'published_news_id', 'instagram_media_id', 'facebook_post_id', 'version', 'reviewed_at',
        'show_on_homepage',
    ];

    protected $casts = [
        'labels' => 'array', 'sources_used' => 'array',
        'warnings' => 'array',
        'reviewed_at' => 'datetime',
        'show_on_homepage' => 'boolean',
    ];

    /** Convert legacy API/queued payloads; only canonical columns are persisted. */
    public function fill(array $attributes)
    {
        if (array_key_exists('headline', $attributes) && ! array_key_exists('title', $attributes)) {
            $attributes['title'] = $attributes['headline'];
        }
        if (array_key_exists('summary', $attributes) && ! array_key_exists('excerpt', $attributes)) {
            $attributes['excerpt'] = $attributes['summary'];
        }
        if (! array_key_exists('content', $attributes) && (array_key_exists('lead', $attributes) || array_key_exists('body', $attributes))) {
            $body = $attributes['body'] ?? $this->body;
            $lead = $attributes['lead'] ?? $this->lead;
            $parts = ($attributes['creation_method'] ?? $this->creation_method) === 'manual' ? $body : [$lead, ...$body];
            $attributes['content'] = collect($parts)->filter(fn ($p) => trim((string) $p) !== '')->join("\n\n");
        }
        unset($attributes['headline'], $attributes['subheadline'], $attributes['lead'], $attributes['body'], $attributes['summary']);

        return parent::fill($attributes);
    }

    // Compatibility at the structured AI / older client boundary, not database columns.
    public function getHeadlineAttribute(): string
    {
        return (string) $this->title;
    }

    public function getSubheadlineAttribute(): ?string
    {
        return null;
    }

    public function getSummaryAttribute(): string
    {
        return (string) $this->excerpt;
    }

    public function getLeadAttribute(): string
    {
        return preg_split('/\R\s*\R/', (string) $this->content)[0];
    }

    public function getBodyAttribute(): array
    {
        $parts = preg_split('/\R\s*\R/', (string) $this->content);

        return $this->creation_method === 'manual' ? $parts : (array_slice($parts, 1) ?: ['']);
    }

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
