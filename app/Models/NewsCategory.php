<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsCategory extends Model
{
    protected $table = 'news_categories';
    protected $primaryKey = 'categoryID';

    protected $fillable = ['name', 'description'];

    public function news()
    {
        return $this->hasMany(News::class, 'category_id', 'categoryID');
    }
}
