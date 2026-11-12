<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->requireVerifiedBackup();
        $this->verifyReports('comment_reports');
        $this->verifyReports('short_video_comment_reports');
        $this->verifyModeratorSnapshot('comments', 'commentID', 'comment_moderation_history');
        $this->verifyModeratorSnapshot('short_video_comments', 'id', 'short_video_comment_history');

        if (Schema::hasColumn('short_video_comments', 'moderation_assessment')
            && DB::table('short_video_comments')->whereNotNull('moderation_assessment')->exists()) {
            throw new RuntimeException('Video moderation assessments exist and require a separate verified archive.');
        }

        foreach (['comment_reports', 'short_video_comment_reports'] as $table) {
            if (Schema::hasColumn($table, 'reason')) {
                Schema::table($table, fn (Blueprint $schema) => $schema->dropColumn('reason'));
            }
        }
        if (Schema::hasColumn('comments', 'moderator_id')) {
            Schema::table('comments', fn (Blueprint $table) => $table->dropColumn('moderator_id'));
        }
        if (Schema::hasColumn('short_video_comments', 'moderator_id')) {
            Schema::table('short_video_comments', fn (Blueprint $table) => $table->dropConstrainedForeignId('moderator_id'));
        }
        if (Schema::hasColumn('short_video_comments', 'moderation_assessment')) {
            Schema::table('short_video_comments', fn (Blueprint $table) => $table->dropColumn('moderation_assessment'));
        }
    }

    private function verifyReports(string $table): void
    {
        if (! Schema::hasColumn($table, 'reason')) {
            return;
        }
        DB::table($table)->orderBy('id')->chunkById(100, function ($reports) use ($table) {
            foreach ($reports as $report) {
                $reconstructed = $report->category.($report->explanation ? ': '.$report->explanation : '');
                $legacyFreeText = $report->category === 'Lainnya' && $report->explanation === $report->reason;
                if (! $report->category || ($report->reason !== $reconstructed && ! $legacyFreeText)) {
                    throw new RuntimeException("Unpreserved report reason in {$table} ID {$report->id}.");
                }
            }
        });
    }

    private function verifyModeratorSnapshot(string $table, string $key, string $history): void
    {
        if (! Schema::hasColumn($table, 'moderator_id')) {
            return;
        }
        DB::table($table)->whereNotNull('moderator_id')->orderBy($key)->chunkById(100, function ($comments) use ($table, $key, $history) {
            foreach ($comments as $comment) {
                $latest = DB::table($history)->where('comment_id', $comment->$key)
                    ->whereNotNull('moderator_id')->orderByDesc('id')->value('moderator_id');
                if ((string) $latest !== (string) $comment->moderator_id) {
                    throw new RuntimeException("Moderator snapshot differs from history for {$table} ID {$comment->$key}.");
                }
            }
        }, $key);
    }

    private function hasLegacyData(): bool
    {
        foreach ([
            'comment_reports' => ['reason'],
            'short_video_comment_reports' => ['reason'],
            'comments' => ['moderator_id'],
            'short_video_comments' => ['moderator_id', 'moderation_assessment'],
        ] as $table => $columns) {
            foreach ($columns as $column) {
                if (Schema::hasColumn($table, $column)
                    && DB::table($table)->whereNotNull($column)->exists()) {
                    return true;
                }
            }
        }

        return false;
    }

    private function requireVerifiedBackup(): void
    {
        if (app()->environment('testing') || ! $this->hasLegacyData()) {
            return;
        }
        $path = getenv('APAKHABAR_MODERATION_BACKUP_PATH');
        $expected = getenv('APAKHABAR_MODERATION_BACKUP_SHA256');
        if (! is_string($path) || ! is_file($path) || ! is_string($expected)
            || ! preg_match('/^[a-f0-9]{64}$/i', $expected)
            || ! hash_equals(strtolower($expected), hash_file('sha256', $path))) {
            throw new RuntimeException('A verified SQL backup path and SHA-256 are required before moderation cleanup.');
        }
    }

    public function down(): void
    {
        throw new RuntimeException('Removed moderation columns require a verified manual restore from backup.');
    }
};
