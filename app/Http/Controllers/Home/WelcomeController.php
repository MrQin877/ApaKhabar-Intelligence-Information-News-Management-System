<?php

namespace App\Http\Controllers\Home;

use App\Http\Controllers\Controller;
use App\Models\Broadcast;
use App\Models\News;
use App\Support\ArticleText;
use App\Support\NewsImageUrl;
use Inertia\Inertia;
use Laravel\Fortify\Features;

class WelcomeController extends Controller
{
    public function index()
    {
        $news = News::active()->with('categoryRecord')->latest()->get()->map(function ($item) {
            return [
                'id' => (string) $item->getKey(),
                'featured' => $item->show_on_homepage,
                'title' => $item->title,
                'preview' => ArticleText::preview($item->content),
                'image' => NewsImageUrl::forWeb($item->image) ?? 'https://placehold.co/600x400',
                'date' => optional($item->created_at)->format('d F Y') ?? '-',
                'category' => $item->category ?? 'Umum',
            ];
        });

        $homepage = $news->where('featured', true)->values();
        $featuredNews = $homepage->first();
        $newsList = $homepage->skip(1)->values();
        // Reserve three supporting cards when enough homepage stories are available.
        $slideCount = max(1, min(5, $homepage->count() - 3));
        $featuredSlides = $homepage->take($slideCount)->values();
        $supportingNews = $homepage->skip($slideCount)->take(3)->values();
        // Latest includes featured stories too, so small collections never disappear.
        $remainingNews = $news->values();

        $broadcasts = Broadcast::publicEmergency()->get();

        return Inertia::render('welcome', [
            'shorts' => \App\Models\ShortVideo::where('status', 'published')->whereNotNull('published_at')->latest('published_at')->latest('id')->take(6)->get(['id', 'title', 'description', 'thumbnail_url', 'video_url', 'published_at', 'view_count']),
            'featuredNews' => $featuredNews,
            'featuredSlides' => $featuredSlides,
            'supportingNews' => $supportingNews,
            'remainingNews' => $remainingNews,
            'newsList' => $newsList,
            'emergencyBroadcasts' => $broadcasts->map->publicEmergencyData()->values(),
            'canRegister' => Features::enabled(Features::registration()),
        ]);
    }
}
