<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->requireVerifiedBackup();
        $this->verify(
            'comment_moderation_assessments', 'archived_comment_moderation_assessments',
            ['id', 'comment_id', 'classification', 'ai_flagged', 'categories', 'category_scores', 'reason',
                'initial_status', 'requested_model', 'returned_model', 'source', 'assessed_at', 'created_at'],
            'comment_snapshot',
        );
        $this->verify(
            'comment_moderation_feedback', 'archived_comment_moderation_feedback',
            ['id', 'comment_id', 'assessment_id', 'history_id', 'administrator_id', 'classification',
                'category', 'explanation', 'verification_status', 'request_id', 'expected_revision', 'created_at'],
            'history_snapshot',
        );

        $missingAssessment = DB::table('archived_comment_moderation_feedback as feedback')
            ->leftJoin('archived_comment_moderation_assessments as assessment', 'feedback.assessment_id', '=', 'assessment.id')
            ->whereNull('assessment.id')->exists();
        if ($missingAssessment) {
            throw new RuntimeException('Archived feedback has no matching archived assessment.');
        }

        Schema::dropIfExists('comment_moderation_feedback');
        Schema::dropIfExists('comment_moderation_assessments');
    }

    private function verify(string $source, string $archive, array $fields, string $requiredSnapshot): void
    {
        if (! Schema::hasTable($source)) {
            return;
        }
        if (! Schema::hasTable($archive) || DB::table($source)->count() !== DB::table($archive)->count()) {
            throw new RuntimeException("Archive count mismatch for {$source}.");
        }
        DB::table($source)->orderBy('id')->chunkById(100, function ($rows) use ($archive, $fields, $requiredSnapshot) {
            foreach ($rows as $row) {
                $saved = DB::table($archive)->where('id', $row->id)->first();
                $original = [];
                $copy = [];
                foreach ($fields as $field) {
                    $original[$field] = $row->$field;
                    $copy[$field] = $saved?->$field;
                }
                $hash = hash('sha256', json_encode($original, JSON_THROW_ON_ERROR));
                $archiveHash = hash('sha256', json_encode($copy, JSON_THROW_ON_ERROR));
                if (! $saved || ! $saved->$requiredSnapshot
                    || ! hash_equals($hash, $saved->source_sha256)
                    || ! hash_equals($hash, $archiveHash)) {
                    throw new RuntimeException("Archive integrity mismatch for {$archive} ID {$row->id}.");
                }
            }
        });
    }

    private function hasLegacyData(): bool
    {
        foreach (['comment_moderation_assessments', 'comment_moderation_feedback'] as $table) {
            if (Schema::hasTable($table) && DB::table($table)->exists()) {
                return true;
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
            throw new RuntimeException('A verified SQL backup path and SHA-256 are required before retiring moderation tables.');
        }
    }

    public function down(): void
    {
        throw new RuntimeException('Retired moderation tables require a verified manual restore from backup.');
    }
};
