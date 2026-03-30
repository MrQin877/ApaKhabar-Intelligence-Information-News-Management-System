<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\News;
use App\Models\Like;
use App\Models\Comment;
use App\Models\User;
use Illuminate\Http\Request;

class NewsController extends Controller
{
    // GET /api/news
    public function index(Request $request)
    {
        $category = $request->query('category');
        $query = News::latest();

        if ($category) {
            $query->where('category', $category);
        }

        $news = $query->get()->map(fn ($item) => [
            'id'       => (string) $item->_id,
            'title'    => $item->title,
            'excerpt'  => $item->excerpt ?? '',
            'body'     => $item->content ?? '',
            'image'    => $item->image ?? 'https://placehold.co/600x400',
            'date'     => optional($item->created_at)->format('d F Y') ?? '-',
            'category' => $item->category ?? 'Umum',
            'views'    => $item->views ?? 0,
            'likes'    => $item->likes_count ?? 0,
            'comments' => 0,
        ]);

        return response()->json($news);
    }

    // GET /api/news/{id}
    public function show(Request $request, $id)
    {
        $news = News::find($id);

        if (!$news) {
            return response()->json(['message' => 'Berita tidak ditemukan.'], 404);
        }

        $news->increment('views');

        $comments = Comment::where('news_id', (string) $news->_id)
            ->whereNull('parent_id')
            ->get()
            ->map(fn ($c) => [
                'id'      => (string) $c->_id,
                'content' => $c->content,
                'user'    => optional(User::find($c->user_id))->name ?? 'Unknown',
                'date'    => optional($c->created_at)->diffForHumans(),
            ]);

        return response()->json([
            'data' => [
                'id'            => (string) $news->_id,
                'title'         => $news->title,
                'excerpt'       => $news->excerpt ?? '',
                'body'          => $news->content ?? '',
                'image'         => $news->image ?? 'https://placehold.co/800x400',
                'date'          => optional($news->created_at)->format('d F Y') ?? '-',
                'category'      => $news->category ?? 'Umum',
                'views'         => $news->views ?? 0,
                'likes'         => $news->likes_count ?? 0,
                'comments'      => $comments->count(),
                'liked_by_user' => auth()->check()
                    ? Like::where('news_id', (string) $news->_id)
                           ->where('user_id', auth()->id())
                           ->exists()
                    : false,
                'comments_list' => $comments,
            ]
        ]);
    }

    // GET /api/news/{id}/related
    public function related($id)
    {
        try {
            $related = News::latest()
                ->limit(10)
                ->get()
                ->filter(fn ($item) => (string) $item->_id !== (string) $id)
                ->take(3)
                ->values()
                ->map(fn ($item) => [
                    'id'       => (string) $item->_id,
                    'title'    => $item->title,
                    'category' => $item->category ?? 'Umum',
                    'image'    => $item->image ?? 'https://placehold.co/600x400',
                ]);

            return response()->json(['data' => $related]);

        } catch (\Exception $e) {
            return response()->json(['data' => []]);
        }
    }
}