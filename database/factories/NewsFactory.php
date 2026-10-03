<?php

namespace Database\Factories;

use App\Models\News;
use App\Models\NewsCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

class NewsFactory extends Factory
{
    protected $model = News::class;

    public function definition(): array
    {
        return [
            'title' => fake()->sentence(),
            'content' => fake()->paragraphs(3, true),
            'excerpt' => fake()->sentence(),
            'category_id' => NewsCategory::firstOrCreate([
                'name' => 'Pengumuman',
            ])->getKey(),
            'image' => null,
            'view' => 0,
            'likes_count' => 0,
        ];
    }
}