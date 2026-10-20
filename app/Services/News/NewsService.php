<?php

namespace App\Services\News;

use App\Models\Comment;
use App\Models\IntelligentNewsDraft;
use App\Models\Like;
use App\Models\News;
use App\Support\ArticleText;

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
                'preview' => ArticleText::preview($item->content),
                'body' => $item->content ?? '',
                'image' => $item->image ?? 'https://placehold.co/600x400',
                'date' => optional($item->created_at)->format('d F Y') ?? '-',
                'category' => $item->category ?? 'Umum',
                'views' => $item->unique_views ?? 0,
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

        $originalImage = IntelligentNewsDraft::where('published_news_id', $news->getKey())
            ->latest('id')->value('image');

        $published = Comment::where('newsID', $news->getKey())
            ->where('status', 'published')->with('author')->withCount('likes')
            ->withExists([
                'likes as liked_by_user' => fn ($query) => $query->where('users.userID', auth()->id()),
                'reporters as reported_by_user' => fn ($query) => $query->where('users.userID', auth()->id()),
            ])->oldest()->get()->keyBy('commentID');
        $comments = $published->filter(function ($comment) use ($published) {
            $parentId = $comment->parentID;
            $seen = [];
            while ($parentId) {
                if (isset($seen[$parentId]) || ! isset($published[$parentId])) {
                    return false;
                }
                $seen[$parentId] = true;
                $parentId = $published[$parentId]->parentID;
            }

            return true;
        })->map(fn ($comment) => [
            'id' => (string) $comment->getKey(), 'content' => $comment->content,
            'author' => $comment->author?->name ?? $comment->guest_name ?? 'Tamu',
            'user' => $comment->author?->name ?? $comment->guest_name ?? 'Tamu',
            'avatar' => $comment->author?->avatar,
            'parent_id' => $comment->parentID ? (string) $comment->parentID : null,
            'date' => $comment->created_at?->locale('id')->diffForHumans(),
            'likes_count' => $comment->likes_count,
            'liked_by_user' => (bool) $comment->liked_by_user,
            'reported_by_user' => (bool) $comment->reported_by_user,
        ])->values();

        return [
            'id' => (string) $news->getKey(),
            'title' => $news->title,
            'content' => $news->content,
            'body' => $news->content,
            'image' => $news->image ?? 'https://placehold.co/800x400',
            'original_image' => $originalImage ?: ($news->image ?? 'https://placehold.co/800x400'),
            'date' => optional($news->created_at)->format('d F Y') ?? '-',
            'category' => $news->category ?? 'Umum',
            'views' => $news->unique_views ?? 0,
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
