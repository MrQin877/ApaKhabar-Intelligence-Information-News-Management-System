<?php

namespace App\Services\Shorts;

use App\Models\ShortVideo;
use App\Models\ShortVideoComment;
use App\Services\News\CommentModeration;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ShortCommentService
{
    public function add(ShortVideo $video, ?int $userId, string $content, ?ShortVideoComment $parent = null): ShortVideoComment
    {
        abort_unless($video->status === 'published' && $video->published_at, 404);
        if ($parent) {
            abort_unless($parent->short_video_id === $video->id && $parent->status === 'published', 404);
        }
        $content = trim($content);
        $hash = hash('sha256', $video->id.'|'.mb_strtolower(preg_replace('/\s+/u', ' ', $content)));
        if (ShortVideoComment::where('submission_hash', $hash)->exists()) {
            throw ValidationException::withMessages(['content' => 'Komentar yang sama sudah dikirim.']);
        }
        $moderation = app(CommentModeration::class)->check($content);
        $assessment = $moderation['_assessment'] ?? [];
        unset($moderation['_assessment']);

        return DB::transaction(function () use ($video, $userId, $content, $parent, $hash, $moderation, $assessment) {
            ShortVideo::whereKey($video->id)->where('status', 'published')->lockForUpdate()->firstOrFail();
            if (ShortVideoComment::where('submission_hash', $hash)->exists()) {
                throw ValidationException::withMessages(['content' => 'Komentar yang sama sudah dikirim.']);
            }
            $comment = ShortVideoComment::create([
                'short_video_id' => $video->id,
                'user_id' => $userId,
                'parent_id' => $parent?->id,
                'root_id' => $parent ? ($parent->root_id ?: $parent->id) : null,
                'guest_name' => $userId ? null : 'guest'.random_int(100000, 999999),
                'content' => $content,
                'submission_hash' => $hash,
                'moderation_assessment' => $assessment,
                ...$moderation,
            ]);
            DB::table('short_video_comment_history')->insert([
                'comment_id' => $comment->id,
                'from_status' => null,
                'to_status' => $comment->status,
                'reason' => $comment->moderation_reason ?? 'submitted',
                'created_at' => now(),
            ]);

            return $comment;
        });
    }
}
