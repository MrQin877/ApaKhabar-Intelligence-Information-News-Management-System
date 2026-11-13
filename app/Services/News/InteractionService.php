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

    public function likeComment(int $userId, string $commentId): array
    {
        return DB::transaction(function () use ($userId, $commentId) {
            $comment = Comment::where('status', 'published')->lockForUpdate()->findOrFail($commentId);
            News::active()->findOrFail($comment->newsID);
            $query = DB::table('comment_likes')->where('comment_id', $commentId)->where('user_id', $userId);
            $existing = $query->exists();
            if ($existing) {
                $query->delete();
            } else {
                DB::table('comment_likes')->insert(['comment_id' => $commentId, 'user_id' => $userId]);
            }

            return ['liked' => ! $existing, 'likes_count' => DB::table('comment_likes')->where('comment_id', $commentId)->count()];
        });
    }

    public function addComment(?int $userId, string $newsId, string $content, ?int $parentId = null, ?string $guestName = null): Comment
    {
        $news = News::active()->findOrFail($newsId);
        $content = trim($content);
        $guestName = $userId ? null : ($guestName ?? 'Guest'.random_int(10000, 99999));
        $normalized = mb_strtolower(preg_replace('/\s+/u', ' ', $content));
        $legacyHash = hash('sha256', $newsId.'|'.$normalized);
        $hash = hash('sha256', json_encode([(string) $news->getKey(), $userId, $guestName, $parentId, $normalized]));
        // A repeated submission belongs to one author and one reply target.
        // Read legacy hashes too, without rewriting existing moderation records.
        $duplicate = fn () => Comment::where('newsID', $news->getKey())->where('parentID', $parentId)
            ->where('userID', $userId)->when($userId === null, fn ($query) => $query->where('guest_name', $guestName))
            ->whereIn('submission_hash', [$hash, $legacyHash])->exists();
        if ($duplicate()) {
            throw ValidationException::withMessages(['content' => 'Komentar yang sama sudah dikirim.']);
        }
        $moderation = app(CommentModeration::class)->check($content);

        return DB::transaction(function () use ($news, $userId, $content, $parentId, $guestName, $hash, $moderation, $duplicate) {
            // Serialize the duplicate check and insert, including concurrent submissions.
            News::active()->whereKey($news->getKey())->lockForUpdate()->firstOrFail();
            if ($duplicate()) {
                throw ValidationException::withMessages(['content' => 'Komentar yang sama sudah dikirim.']);
            }
            $comment = Comment::create(array_merge($moderation, [
                'newsID' => $news->getKey(), 'userID' => $userId, 'content' => $content,
                'guest_name' => $userId ? null : ($guestName ?? 'Guest'.random_int(10000, 99999)), 'parentID' => $parentId,
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

    public function addReply(?int $userId, string $commentId, string $content, ?string $guestName = null): Comment
    {
        $parent = Comment::where('status', 'published')->findOrFail($commentId);

        return $this->addComment($userId, (string) $parent->newsID, $content, $parent->getKey(), $guestName);
    }
}
