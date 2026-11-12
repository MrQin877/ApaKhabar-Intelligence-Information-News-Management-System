<?php

namespace App\Http\Controllers\Home;

use App\Http\Controllers\Controller;
use App\Models\ShortVideo;
use Illuminate\Http\Request;
use Inertia\Inertia;

class VideoPageController extends Controller
{
    public function index(Request $request)
    {
        $columns = ['id', 'title', 'description', 'thumbnail_url', 'view_count'];
        $published = ShortVideo::query()->where('status', 'published')->whereNotNull('published_at')
            ->select($columns)->withPublicEngagement();
        $topShorts = (clone $published)->orderByDesc('view_count')->orderByDesc('published_at')
            ->orderByDesc('id')->limit(3)->get();
        $shorts = (clone $published)->whereNotIn('id', $topShorts->pluck('id'))
            ->orderByDesc('published_at')->orderByDesc('id')->paginate(12);

        if ($request->expectsJson()) {
            return response()->json(['topShorts' => $topShorts, 'shorts' => $shorts]);
        }

        return Inertia::render('videos', [
            'topShorts' => $topShorts,
            'shorts' => $shorts,
        ]);
    }
}
