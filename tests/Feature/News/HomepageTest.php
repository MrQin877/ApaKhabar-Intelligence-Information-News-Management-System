<?php

use App\Models\News;
use App\Models\NewsCategory;
use Inertia\Testing\AssertableInertia as Assert;

test('homepage separates published featured stories from the latest feed and shares active categories', function () {
    $category = NewsCategory::create(['name' => 'Kabar Desa', 'slug' => 'kabar-desa', 'is_active' => true, 'display_order' => 1]);
    NewsCategory::create(['name' => 'Hidden category', 'slug' => 'hidden-category', 'is_active' => false]);
    $featured = collect(range(1, 10))->map(fn ($index) => News::factory()->create([
        'title' => 'Featured '.$index, 'status' => 'active', 'show_on_homepage' => true,
        'category_id' => $category->getKey(), 'created_at' => now()->subMinutes($index),
    ]));
    $regular = News::factory()->create(['title' => 'Latest regular', 'status' => 'active', 'show_on_homepage' => false]);
    News::factory()->create(['title' => 'Unpublished', 'status' => 'archived', 'show_on_homepage' => true]);
    $this->get('/')->assertInertia(fn (Assert $page) => $page->component('welcome')
        ->has('featuredSlides', 5)->has('supportingNews', 3)->has('remainingNews', 3)
        ->where('featuredSlides.0.id', (string) $featured[0]->getKey())
        ->where('supportingNews.0.id', (string) $featured[5]->getKey())
        ->where('remainingNews', fn ($items) => collect($items)->pluck('id')->sort()->values()->all() === collect([$regular->getKey(), $featured[8]->getKey(), $featured[9]->getKey()])->map(fn ($id) => (string) $id)->sort()->values()->all())
        ->where('categories', fn ($items) => collect($items)->contains('Kabar Desa') && ! collect($items)->contains('Hidden category')));
});

test('homepage handles empty and single-story collections', function () {
    $this->get('/')->assertInertia(fn (Assert $page) => $page->has('featuredSlides', 0)->has('supportingNews', 0)->has('remainingNews', 0));
    News::factory()->create(['status' => 'active', 'show_on_homepage' => true]);
    $this->get('/')->assertInertia(fn (Assert $page) => $page->has('featuredSlides', 1)->has('supportingNews', 0)->has('remainingNews', 0));
});
