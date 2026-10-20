<?php

namespace App\Services\News;

use App\Models\Comment;
use App\Models\CommentModerationAssessment;
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
            $to = match ($action) {
                'approve' => $from === 'pending_review' ? 'published' : null,
                'reject' => in_array($from, ['pending_review', 'removed'], true) ? 'rejected' : null,
                'remove' => $from === 'published' ? 'removed' : null,
                'restore' => in_array($from, ['removed', 'rejected'], true) ? 'published' : null,
                'dismiss_reports' => $from === 'published' && DB::table('comment_reports')->where('comment_id', $id)->whereNull('resolved_at')->exists() ? $from : null,
                default => null,
            };
            abort_if($to === null, 409, 'Status komentar telah berubah. Muat ulang halaman.');
            CommentModerationAssessment::capture($comment);
            $comment->forceFill([
                'status' => $to, 'moderator_id' => $actor->getKey(), 'moderated_at' => now(),
                'moderation_revision' => $comment->moderation_revision + 1,
            ])->save();
            $historyId = DB::table('comment_moderation_history')->insertGetId([
                'comment_id' => $id, 'moderator_id' => $actor->getKey(),
                'from_status' => $from, 'to_status' => $to, 'reason' => $action.': '.$reason, 'created_at' => now(),
            ]);
            DB::table('comment_reports')->where('comment_id', $id)->whereNull('resolved_at')->update(['resolved_at' => now()]);

            return $historyId;
        });
    }
}
