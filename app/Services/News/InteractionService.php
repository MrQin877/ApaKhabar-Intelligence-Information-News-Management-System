<?php

namespace App\Services\News;

use App\Models\Comment;
use App\Models\Like;
use App\Models\News;
use Illuminate\Http\Request;

class InteractionService
{
    public function likeNews(int $userId, string $newsId): array
    {
        $news = News::find($newsId);

        if (! $news) {
            abort(404);
        }

        $existing = Like::where('postID', $news->getKey())
            ->where('userID', $userId)
            ->first();

        if ($existing) {
            $existing->delete();
            $news->decrement('likes_count');
            $liked = false;
        } else {
            Like::create([
                'postID' => $news->getKey(),
                'userID' => $userId,
            ]);
            $news->increment('likes_count');
            $liked = true;
        }

        return [
            'liked' => $liked,
            'likes_count' => $news->fresh()->likes_count,
        ];
    }

    public function addComment(int $userId, string $newsId, string $content): Comment
    {
        $news = News::find($newsId);

        if (! $news) {
            abort(404);
        }

        return Comment::create([
            'newsID' => $news->getKey(),
            'userID' => $userId,
            'content' => $content,
            'parentID' => null,
        ]);
    }

    public function addReply(int $userId, string $commentId, string $content): Comment
    {
        $comment = Comment::find($commentId);

        if (! $comment) {
            abort(404);
        }

        return Comment::create([
            'newsID' => $comment->newsID,
            'userID' => $userId,
            'content' => $content,
            'parentID' => $comment->getKey(),
        ]);
    }
}
