<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\News;
use App\Models\Like;
use App\Models\Comment;
use Illuminate\Http\Request;

class NewsController extends Controller
{
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
            'image'    => $item->image ?? 'https://placehold.co/600x400',
            'date'     => optional($item->created_at)->format('d F Y') ?? '-',
            'category' => $item->category ?? 'Umum',
        ]);

        return response()->json($news);
    }

    public function show(Request $request, $id)
    {
        $news = News::find($id);

        if (!$news) {
            return response()->json(['message' => 'News not found'], 404);
        }

        $news->increment('views');

        // Load comments with user info
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
            'id'            => (string) $news->_id,
            'title'         => $news->title,
            'excerpt'       => $news->excerpt ?? '',
            'content'       => $news->content,
            'image'         => $news->image ?? 'https://placehold.co/800x400',
            'date'          => optional($news->created_at)->format('d F Y') ?? '-',
            'category'      => $news->category ?? 'Umum',
            'views'         => $news->views ?? 0,
            'likes_count'   => $news->likes_count ?? 0,
            'liked_by_user' => auth()->check()
                ? Like::where('news_id', (string) $news->_id)
                       ->where('user_id', auth()->id())
                       ->exists()
                : false,
            'comments'      => $comments,
        ]);
    }
}