<?php

namespace App\Services\Shorts;

use App\Models\ShortVideoComment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ShortCommentDecisionService
{
    public function decide(User $actor, int $id, string $action, string $reason, ?int $expectedRevision = null): void
    {
        abort_unless($actor->hasVerifiedEmail() && ($actor->isAdmin() || $actor->isModerator()), 403);

        DB::transaction(function () use ($actor, $id, $action, $reason, $expectedRevision) {
            $comment = ShortVideoComment::lockForUpdate()->findOrFail($id);
            abort_if($expectedRevision !== null && $comment->moderation_revision !== $expectedRevision, 409, 'Komentar telah berubah. Muat ulang halaman.');
            $from = $comment->status;
            $hasReports = DB::table('short_video_comment_reports')->where('comment_id', $id)->whereNull('resolved_at')->exists();
            $hasFlags = DB::table('short_video_comment_flags')->where('comment_id', $id)->whereNull('resolved_at')->exists();
            $to = match ($action) {
                'approve' => $from === 'pending_review' ? 'published' : null,
                'reject' => in_array($from, ['pending_review', 'removed'], true) ? 'rejected' : null,
                'remove' => $from === 'published' ? 'removed' : null,
                'restore' => in_array($from, ['removed', 'rejected'], true) ? 'published' : null,
                'dismiss_reports' => $from === 'published' && ($hasReports || $hasFlags) ? $from : null,
                default => null,
            };
            abort_if($to === null, 409, 'Status komentar telah berubah. Muat ulang halaman.');
            $comment->forceFill([
                'status' => $to,
                'moderator_id' => $actor->getKey(),
                'moderated_at' => now(),
                'moderation_revision' => $comment->moderation_revision + 1,
            ])->save();
            DB::table('short_video_comment_history')->insert([
                'comment_id' => $id,
                'moderator_id' => $actor->getKey(),
                'from_status' => $from,
                'to_status' => $to,
                'reason' => $action.': '.$reason,
                'created_at' => now(),
            ]);
            DB::table('short_video_comment_reports')->where('comment_id', $id)->whereNull('resolved_at')->update(['resolved_at' => now()]);
            DB::table('short_video_comment_flags')->where('comment_id', $id)->whereNull('resolved_at')->update(['resolved_at' => now()]);
        });
    }
}
