<?php

namespace App\Http\Controllers\Home;

use App\Http\Controllers\Controller;
use App\Models\ShortVideo;
use Inertia\Inertia;

class VideoPageController extends Controller
{
    public function index()
    {
        $published = ShortVideo::query()->where('status', 'published')->whereNotNull('published_at');
        $columns = ['id', 'title', 'description', 'thumbnail_url', 'view_count'];
        $topShorts = (clone $published)->orderByDesc('view_count')->orderByDesc('published_at')
            ->orderByDesc('id')->limit(3)->get($columns);
        $shorts = (clone $published)->whereNotIn('id', $topShorts->pluck('id'))
            ->orderByDesc('published_at')->orderByDesc('id')->paginate(12, $columns);

        return Inertia::render('videos', [
            'topShorts' => $topShorts,
            'shorts' => $shorts,
        ]);
    }
}
