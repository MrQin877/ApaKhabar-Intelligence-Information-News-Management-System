<?php

namespace App\Http\Controllers;

use App\Models\Broadcast;
use App\Models\News;
use Inertia\Inertia;
use Laravel\Fortify\Features;

class WelcomeController extends Controller
{
    public function index()
    {
        $news = News::latest()->get()->map(function ($item) {
            return [
                'id'       => (string) $item->getKey(),
                'title'    => $item->title,
                'excerpt'  => $item->excerpt ?? '',
                'image'    => $item->image ?? 'https://placehold.co/600x400',
                'date'     => optional($item->created_at)->format('d F Y') ?? '-',
                'category' => $item->category ?? 'Umum',
            ];
        });

        $featuredNews = $news->first();
        $newsList     = $news->skip(1)->values();

        // ── Darurat broadcast — only show if sent within last 24 hours ──
        $daruratBroadcast = Broadcast::category('darurat')
            ->where('status', 'dikirim')
            ->where('sent_at', '>=', now()->subHours(24))
            ->whereNull('archived_at')
            ->latest('sent_at')
            ->first();

        return Inertia::render('welcome', [
            'featuredNews'     => $featuredNews,
            'newsList'         => $newsList,
            'breakingNews'     => $daruratBroadcast?->title,
            'breakingMessage'  => $daruratBroadcast?->message,
            'breakingSentAt'   => $daruratBroadcast?->sent_at?->toISOString(),
            'canRegister'      => Features::enabled(Features::registration()),
        ]);
    }
}