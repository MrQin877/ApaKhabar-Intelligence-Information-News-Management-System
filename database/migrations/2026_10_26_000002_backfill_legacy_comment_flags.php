<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('comment_moderation_feedback as feedback')
            ->join('comments', 'comments.commentID', '=', 'feedback.comment_id')
            ->where('comments.status', 'removed')
            ->where('feedback.classification', 'inappropriate')
            ->whereNotNull('feedback.administrator_id')
            ->whereNotExists(function ($query) {
                $query->selectRaw('1')->from('comment_moderation_history as newer')
                    ->whereColumn('newer.comment_id', 'feedback.comment_id')
                    ->whereColumn('newer.id', '>', 'feedback.history_id');
            })
            ->select('feedback.*')
            ->orderBy('feedback.id')
            ->chunk(100, function ($feedbackRows) {
                foreach ($feedbackRows as $feedback) {
                    $open = DB::table('comment_flags')->where('comment_id', $feedback->comment_id)
                        ->where('moderator_id', $feedback->administrator_id)->whereNull('resolved_at')->exists();
                    if (! $open) {
                        DB::table('comment_flags')->insert([
                            'comment_id' => $feedback->comment_id,
                            'moderator_id' => $feedback->administrator_id,
                            'category' => $feedback->category,
                            'explanation' => $feedback->explanation,
                            'created_at' => $feedback->created_at,
                        ]);
                    }
                }
            });
    }

    public function down(): void
    {
        throw new RuntimeException('Rollback would discard or misclassify migrated moderation flags.');
    }
};
