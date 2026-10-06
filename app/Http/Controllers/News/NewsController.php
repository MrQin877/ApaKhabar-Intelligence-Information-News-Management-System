<?php

namespace App\Http\Controllers\News;

use App\Http\Controllers\Controller;
use App\Services\News\NewsService;
use App\Support\NewsImageUrl;
use Illuminate\Http\Request;
use Inertia\Inertia;

class NewsController extends Controller
{
    public function __construct(protected NewsService $newsService) {}

    public function index(Request $request)
    {
        $category = $request->query('category');
        $news = $this->newsService->listNews($category);

        if ($request->expectsJson()) {
            return response()->json($news);
        }

        return Inertia::render('newscategory', [
            'newsList' => collect($news)->map(fn ($item) => [
                'id' => $item['id'],
                'title' => $item['title'],
                'preview' => $item['preview'],
                'image' => NewsImageUrl::forWeb($item['image']),
                'date' => $item['date'],
                'category' => $item['category'],
            ])->all(),
            'activeCategory' => $category ?? 'Semua',
        ]);
    }

    public function show(Request $request, $id)
    {
        $news = $this->newsService->getNewsDetail($id);

        if (! $news) {
            abort(404);
        }

        if ($request->expectsJson()) {
            return response()->json(['data' => $news]);
        }

        return Inertia::render('newsdetails', [
            'news' => [
                'id' => $news['id'],
                'title' => $news['title'],
                'content' => $news['content'],
                'image' => NewsImageUrl::forWeb($news['image']),
                'original_image' => NewsImageUrl::forWeb($news['original_image']),
                'date' => $news['date'],
                'category' => $news['category'],
                'views' => $news['views'],
                'likes_count' => $news['likes_count'],
                'liked_by_user' => $news['liked_by_user'],
            ],
            'comments' => [],
        ]);
    }

    public function related(Request $request, $id)
    {
        try {
            $related = $this->newsService->getRelatedNews($id);

            return response()->json(['data' => $related]);
        } catch (\Exception $e) {
            return response()->json(['data' => []]);
        }
    }
}
