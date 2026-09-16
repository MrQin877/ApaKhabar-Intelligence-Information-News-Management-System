<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsCategory extends Model
{
    protected $table = 'news_categories';
    protected $primaryKey = 'categoryID';

    protected $fillable = [
        'name', 'slug', 'description', 'status', 'display_order', 'is_default', 'created_by',
    ];

    protected $casts = ['is_default' => 'boolean', 'display_order' => 'integer'];

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
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
