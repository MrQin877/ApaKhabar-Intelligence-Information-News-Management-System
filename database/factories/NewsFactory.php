<?php

namespace Database\Factories;

use App\Models\News;
use Illuminate\Database\Eloquent\Factories\Factory;

class NewsFactory extends Factory
{
    protected $model = News::class;

    public function definition(): array
    {
        return [
            'title'       => fake()->sentence(),
            'content'     => fake()->paragraphs(3, true),
            'excerpt'     => fake()->sentence(),
            'category'    => fake()->randomElement(['Pengumuman', 'Darurat', 'Berita']),
            'image'       => null,
            'date'        => now()->toDateString(),
            'views'       => 0,
            'likes_count' => 0,
        ];
    }
}