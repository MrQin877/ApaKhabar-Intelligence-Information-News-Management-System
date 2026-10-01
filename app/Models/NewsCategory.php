<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class NewsCategory extends Model
{
    use SoftDeletes;

    protected $table = 'news_categories';

    protected $primaryKey = 'categoryID';

    protected $fillable = [
        'name', 'slug', 'description', 'status', 'is_active', 'display_order', 'is_default', 'created_by',
    ];

    protected $casts = ['is_active' => 'boolean', 'is_default' => 'boolean', 'display_order' => 'integer'];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // Keep the existing UI/API status field compatible with the boolean source of truth.
    public function setStatusAttribute(string $value): void
    {
        $this->attributes['status'] = $value;
        $this->attributes['is_active'] = $value === 'active';
    }

    public function setIsActiveAttribute(bool $value): void
    {
        $this->attributes['is_active'] = $value;
        $this->attributes['status'] = $value ? 'active' : 'inactive';
    }

    public function getStatusAttribute(): string
    {
        return ($this->attributes['is_active'] ?? true) ? 'active' : 'inactive';
    }

    public function news()
    {
        return $this->hasMany(News::class, 'category_id', 'categoryID');
    }

    public function drafts()
    {
        return $this->hasMany(IntelligentNewsDraft::class, 'category_id', 'categoryID');
    }
}
