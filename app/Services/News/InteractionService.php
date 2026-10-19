<?php

namespace App\Services\News;

use App\Models\Comment;
use App\Models\Like;
use App\Models\News;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InteractionService
{
    public function likeNews(int $userId, string $newsId): array
    {
        return DB::transaction(function () use ($userId, $newsId) {
            $news = News::active()->lockForUpdate()->findOrFail($newsId);
            $existing = Like::where('postID', $news->getKey())->where('userID', $userId)->first();
            if ($existing) {
                $existing->delete();
            } else {
                Like::create(['postID' => $news->getKey(), 'userID' => $userId]);
            }
            $count = Like::where('postID', $news->getKey())->count();
            $news->update(['likes_count' => $count]);

            return ['liked' => ! $existing, 'likes_count' => $count];
        });
    }

    public function addComment(?int $userId, string $newsId, string $content, ?int $parentId = null): Comment
    {
        $news = News::active()->findOrFail($newsId);
        $content = trim($content);
        $hash = hash('sha256', $newsId.'|'.mb_strtolower(preg_replace('/\s+/u', ' ', $content)));
        if (Comment::where('submission_hash', $hash)->exists()) {
            throw ValidationException::withMessages(['content' => 'Komentar yang sama sudah dikirim.']);
        }
        $moderation = app(CommentModeration::class)->check($content);

        return DB::transaction(function () use ($news, $userId, $content, $parentId, $hash, $moderation) {
            // Serialize the duplicate check and insert, including concurrent submissions.
            News::whereKey($news->getKey())->lockForUpdate()->firstOrFail();
            if (Comment::where('submission_hash', $hash)->exists()) {
                throw ValidationException::withMessages(['content' => 'Komentar yang sama sudah dikirim.']);
            }
            $comment = Comment::create(array_merge($moderation, [
                'newsID' => $news->getKey(), 'userID' => $userId, 'content' => $content,
                'guest_name' => $userId ? null : 'guest'.random_int(100000, 999999), 'parentID' => $parentId,
                'submission_hash' => $hash,
            ]));
            DB::table('comment_moderation_history')->insert([
                'comment_id' => $comment->getKey(), 'from_status' => null,
                'to_status' => $comment->status, 'reason' => $comment->moderation_reason,
                'created_at' => now(),
            ]);

            return $comment;
        });
    }

    public function addReply(int $userId, string $commentId, string $content): Comment
    {
        $parent = Comment::where('status', 'published')->findOrFail($commentId);

        return $this->addComment($userId, (string) $parent->newsID, $content, $parent->getKey());
    }
}
