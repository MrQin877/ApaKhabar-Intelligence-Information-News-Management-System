<?php

namespace App\Http\Controllers;

use App\Models\News;
use App\Models\Like;
use Inertia\Inertia;
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

        $news = $query->get()->map(function ($item) {
            return [
                'id'       => (string) $item->_id,
                'title'    => $item->title,
                'excerpt'  => $item->excerpt ?? '',
                'image'    => $item->image ?? 'https://placehold.co/600x400',
                'date'     => optional($item->created_at)->format('d F Y') ?? '-',
                'category' => $item->category ?? 'Umum',
            ];
        });

        return Inertia::render('newscategory', [
            'newsList'       => $news,
            'activeCategory' => $category ?? 'Semua',
        ]);
    }

    public function show($id)
    {
        $news = News::find($id);

        abort_if(!$news, 404);

        $news->increment('views');

        return Inertia::render('newsdetails', [
            'news' => [
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
            ],
            'comments' => [],
        ]);
    }
}