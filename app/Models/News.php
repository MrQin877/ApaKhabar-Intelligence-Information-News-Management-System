<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class News extends Model
{
    use HasFactory;

    protected $primaryKey = 'postID';

    protected $fillable = [
        'title',
        'content',
        'excerpt',
        'image',
        'category_id',
        'view',
        'likes_count',
    ];

    protected $attributes = [
        'view'        => 0,
        'likes_count' => 0,
    ];

    protected $casts = [
    ];

    public function categoryRecord()
    {
        return $this->belongsTo(NewsCategory::class, 'category_id', 'categoryID');
    }

    public function getCategoryAttribute(): ?string
    {
        return $this->categoryRecord?->name;
    }

    public function scopeCategory(Builder $query, string $category): Builder
    {
        return $query->whereHas('categoryRecord', fn ($query) => $query->where('name', $category));
    }

    public function getViewsAttribute(): int
    {
        return (int) ($this->attributes['view'] ?? 0);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class, 'newsID', 'postID');
    }

    public function likes()
    {
        return $this->hasMany(Like::class, 'postID', 'postID');
    }
}