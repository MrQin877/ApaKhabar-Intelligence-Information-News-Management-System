<?php

namespace App\Services\News;

use App\Models\Comment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ModerationDecisionService
{
    public function decide(User $actor, string $id, string $action, string $reason, ?int $expectedRevision = null): int
    {
        abort_unless($actor->hasVerifiedEmail() && ($actor->isAdmin() || $actor->isModerator()), 403);

        return DB::transaction(function () use ($actor, $id, $action, $reason, $expectedRevision) {
            $comment = Comment::lockForUpdate()->findOrFail($id);
            abort_if($expectedRevision !== null && $comment->moderation_revision !== $expectedRevision, 409, 'Komentar telah berubah. Muat ulang komentar sebelum melanjutkan.');
            $from = $comment->status;
            $open = DB::table('comment_reports')->where('comment_id', $id)->whereNull('resolved_at')->exists()
                || DB::table('comment_flags')->where('comment_id', $id)->whereNull('resolved_at')->exists();
            $to = match ($action) {
                'allow' => $from === 'pending_review' || $open || in_array($from, ['hidden', 'removed', 'rejected'], true) ? 'published' : null,
                'hide' => $from === 'pending_review' || $open || $from === 'published' ? 'hidden' : null,
                default => null,
            };
            abort_if($to === null, 409, 'Status komentar telah berubah. Muat ulang halaman.');
            $comment->forceFill([
                'status' => $to, 'moderated_at' => now(),
                'moderation_revision' => $comment->moderation_revision + 1,
            ])->save();
            $historyId = DB::table('comment_moderation_history')->insertGetId([
                'comment_id' => $id, 'moderator_id' => $actor->getKey(),
                'from_status' => $from, 'to_status' => $to, 'action' => $action, 'reason' => $reason, 'created_at' => now(),
            ]);
            DB::table('comment_reports')->where('comment_id', $id)->whereNull('resolved_at')->update(['resolved_at' => now()]);
            DB::table('comment_flags')->where('comment_id', $id)->whereNull('resolved_at')->update(['resolved_at' => now()]);

            return $historyId;
        });
    }
}
