<?php

namespace App\Services\News;

use App\Models\Comment;
use App\Models\Like;
use App\Models\News;
use App\Models\User;

class NewsService
{
    public function listNews(?string $category = null): array
    {
        $query = News::active()->latest();

        if ($category) {
            $query->category($category);
        }

        return $query->get()->map(function ($item) {
            return [
                'id' => (string) $item->getKey(),
                'title' => $item->title,
                'excerpt' => $item->excerpt ?? '',
                'body' => $item->content ?? '',
                'image' => $item->image ?? 'https://placehold.co/600x400',
                'date' => optional($item->created_at)->format('d F Y') ?? '-',
                'category' => $item->category ?? 'Umum',
                'views' => $item->view ?? 0,
                'likes' => $item->likes_count ?? 0,
                'comments' => 0,
            ];
        })->all();
    }

    public function getNewsDetail(string $id): ?array
    {
        $news = News::active()->find($id);

        if (! $news) {
            return null;
        }

        $news->increment('view');

        $comments = Comment::where('newsID', $news->getKey())
            ->whereNull('parentID')
            ->get()
            ->map(fn ($comment) => [
                'id' => (string) $comment->getKey(),
                'content' => $comment->content,
                'user' => optional(User::find($comment->userID))->name ?? 'Unknown',
                'date' => optional($comment->created_at)->diffForHumans(),
            ]);

        return [
            'id' => (string) $news->getKey(),
            'title' => $news->title,
            'excerpt' => $news->excerpt ?? '',
            'content' => $news->content,
            'body' => $news->content,
            'image' => $news->image ?? 'https://placehold.co/800x400',
            'date' => optional($news->created_at)->format('d F Y') ?? '-',
            'category' => $news->category ?? 'Umum',
            'views' => $news->view ?? 0,
            'likes' => $news->likes_count ?? 0,
            'likes_count' => $news->likes_count ?? 0,
            'liked_by_user' => auth()->check()
                ? Like::where('postID', $news->getKey())
                    ->where('userID', auth()->id())
                    ->exists()
                : false,
            'comments' => $comments->count(),
            'comments_list' => $comments->all(),
        ];
    }

    public function getRelatedNews(string $id): array
    {
        return News::active()->latest()
            ->limit(10)
            ->get()
            ->filter(fn ($item) => (string) $item->getKey() !== (string) $id)
            ->take(3)
            ->values()
            ->map(fn ($item) => [
                'id' => (string) $item->getKey(),
                'title' => $item->title,
                'category' => $item->category ?? 'Umum',
                'image' => $item->image ?? 'https://placehold.co/600x400',
            ])
            ->all();
    }
}
