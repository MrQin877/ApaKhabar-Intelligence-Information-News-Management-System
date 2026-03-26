<?php

namespace App\Http\Controllers;

use App\Models\News;
use Inertia\Inertia;
use Laravel\Fortify\Features;

class WelcomeController extends Controller
{
    public function index()
    {
        $news = News::latest()->get()->map(function ($item) {
            return [
                'id'       => (string) $item->_id,
                'title'    => $item->title,
                'excerpt'  => $item->excerpt ?? '',
                'image'    => $item->image ?? 'https://placehold.co/600x400',
                'date'     => optional($item->created_at)->format('d F Y') ?? '-',
                'category' => $item->category ?? 'Umum',
            ];
        });

        $featuredNews = $news->first();
        $newsList     = $news->skip(1)->values();

        // ↓ Breaking news = latest news title, no special field needed
        $breakingNews = $featuredNews ? $featuredNews['title'] : null;

        return Inertia::render('welcome', [
            'featuredNews' => $featuredNews,
            'newsList'     => $newsList,
            'breakingNews' => $breakingNews,
            'canRegister'  => Features::enabled(Features::registration()),
        ]);
    }
}