<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comment_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained('comments', 'commentID')->cascadeOnDelete();
            $table->foreignId('moderator_id')->constrained('users', 'userID')->cascadeOnDelete();
            $table->string('category', 80);
            $table->string('explanation', 1000)->nullable();
            $table->timestamp('created_at');
            $table->timestamp('resolved_at')->nullable()->index();
            $table->index(['comment_id', 'resolved_at']);
        });

        foreach (['comment_reports', 'short_video_comment_reports'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->string('category', 80)->nullable();
                $table->string('explanation', 450)->nullable();
            });
            DB::table($name)->whereNull('category')->orderBy('id')->chunkById(100, function ($reports) use ($name) {
                foreach ($reports as $report) {
                    [$category, $explanation] = array_pad(explode(': ', $report->reason, 2), 2, null);
                    $known = in_array($category, config('engagement.report_categories'), true);
                    DB::table($name)->where('id', $report->id)->update([
                        'category' => $known ? $category : 'Lainnya',
                        'explanation' => mb_substr($known ? ($explanation ?? '') : $report->reason, 0, 450) ?: null,
                    ]);
                }
            });
        }

        foreach (['comment_moderation_history', 'short_video_comment_history'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->string('action', 24)->nullable());
        }
    }

    public function down(): void
    {
        throw new RuntimeException('Rollback would discard moderation records. Archive and verify them before a manual schema change.');
    }
};
