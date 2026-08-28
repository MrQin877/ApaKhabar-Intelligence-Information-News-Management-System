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
            $query->category($category);
        }

        $news = $query->get()->map(fn ($item) => [
            'id'       => (string) $item->getKey(),
            'title'    => $item->title,
            'excerpt'  => $item->excerpt ?? '',
            'body'     => $item->content ?? '',
            'image'    => $item->image ?? 'https://placehold.co/600x400',
            'date'     => optional($item->created_at)->format('d F Y') ?? '-',
            'category' => $item->category ?? 'Umum',
            'views'    => $item->view ?? 0,
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

        $news->increment('view');

        $comments = Comment::where('newsID', $news->getKey())
            ->whereNull('parentID')
            ->get()
            ->map(fn ($c) => [
                'id'      => (string) $c->getKey(),
                'content' => $c->content,
                'user'    => optional(User::find($c->userID))->name ?? 'Unknown',
                'date'    => optional($c->created_at)->diffForHumans(),
            ]);

        return response()->json([
            'data' => [
                'id'            => (string) $news->getKey(),
                'title'         => $news->title,
                'excerpt'       => $news->excerpt ?? '',
                'body'          => $news->content ?? '',
                'image'         => $news->image ?? 'https://placehold.co/800x400',
                'date'          => optional($news->created_at)->format('d F Y') ?? '-',
                'category'      => $news->category ?? 'Umum',
                'views'         => $news->view ?? 0,
                'likes'         => $news->likes_count ?? 0,
                'comments'      => $comments->count(),
                'liked_by_user' => auth()->check()
                          ? Like::where('postID', $news->getKey())
                              ->where('userID', auth()->id())
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
                ->filter(fn ($item) => (string) $item->getKey() !== (string) $id)
                ->take(3)
                ->values()
                ->map(fn ($item) => [
                    'id'       => (string) $item->getKey(),
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