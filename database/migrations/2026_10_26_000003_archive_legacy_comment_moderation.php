<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const ASSESSMENT_FIELDS = [
        'id', 'comment_id', 'classification', 'ai_flagged', 'categories', 'category_scores',
        'reason', 'initial_status', 'requested_model', 'returned_model', 'source', 'assessed_at', 'created_at',
    ];

    private const FEEDBACK_FIELDS = [
        'id', 'comment_id', 'assessment_id', 'history_id', 'administrator_id', 'classification',
        'category', 'explanation', 'verification_status', 'request_id', 'expected_revision', 'created_at',
    ];

    public function up(): void
    {
        if (! Schema::hasTable('archived_comment_moderation_assessments')) {
            Schema::create('archived_comment_moderation_assessments', function (Blueprint $table) {
                $table->unsignedBigInteger('id')->primary();
                $table->unsignedBigInteger('comment_id')->index();
                $table->string('classification', 24);
                $table->boolean('ai_flagged')->nullable();
                $table->json('categories')->nullable();
                $table->json('category_scores')->nullable();
                $table->string('reason')->nullable();
                $table->string('initial_status', 24)->nullable();
                $table->string('requested_model')->nullable();
                $table->string('returned_model')->nullable();
                $table->string('source', 24);
                $table->timestamp('assessed_at')->nullable();
                $table->timestamp('created_at')->useCurrent();
                $table->json('comment_snapshot')->nullable();
                $table->char('source_sha256', 64);
                $table->timestamp('archived_at')->useCurrent();
            });
        }

        if (! Schema::hasTable('archived_comment_moderation_feedback')) {
            Schema::create('archived_comment_moderation_feedback', function (Blueprint $table) {
                $table->unsignedBigInteger('id')->primary();
                $table->unsignedBigInteger('comment_id')->index();
                $table->unsignedBigInteger('assessment_id')->index();
                $table->unsignedBigInteger('history_id')->unique();
                $table->unsignedBigInteger('administrator_id')->nullable();
                $table->string('classification', 24);
                $table->string('category', 40);
                $table->string('explanation', 1000)->nullable();
                $table->string('verification_status', 24);
                $table->uuid('request_id')->unique();
                $table->unsignedInteger('expected_revision');
                $table->timestamp('created_at')->useCurrent();
                $table->json('comment_snapshot')->nullable();
                $table->json('history_snapshot')->nullable();
                $table->json('administrator_snapshot')->nullable();
                $table->char('source_sha256', 64);
                $table->timestamp('archived_at')->useCurrent();
            });
        }

        DB::table('comment_moderation_assessments')->orderBy('id')->chunkById(100, function ($rows) {
            foreach ($rows as $row) {
                $comment = DB::table('comments')->where('commentID', $row->comment_id)->first();
                DB::table('archived_comment_moderation_assessments')->insertOrIgnore([
                    ...$this->copyFields($row, self::ASSESSMENT_FIELDS),
                    'comment_snapshot' => $comment ? json_encode($comment, JSON_THROW_ON_ERROR) : null,
                    'source_sha256' => $this->fingerprint($row, self::ASSESSMENT_FIELDS),
                    'archived_at' => now(),
                ]);
            }
        });

        DB::table('comment_moderation_feedback')->orderBy('id')->chunkById(100, function ($rows) {
            foreach ($rows as $row) {
                $comment = DB::table('comments')->where('commentID', $row->comment_id)->first();
                $history = DB::table('comment_moderation_history')->where('id', $row->history_id)->first();
                $administrator = $row->administrator_id
                    ? DB::table('users')->where('userID', $row->administrator_id)->first(['userID', 'name']) : null;
                DB::table('archived_comment_moderation_feedback')->insertOrIgnore([
                    ...$this->copyFields($row, self::FEEDBACK_FIELDS),
                    'comment_snapshot' => $comment ? json_encode($comment, JSON_THROW_ON_ERROR) : null,
                    'history_snapshot' => $history ? json_encode($history, JSON_THROW_ON_ERROR) : null,
                    'administrator_snapshot' => $administrator ? json_encode($administrator, JSON_THROW_ON_ERROR) : null,
                    'source_sha256' => $this->fingerprint($row, self::FEEDBACK_FIELDS),
                    'archived_at' => now(),
                ]);
            }
        });

        $this->verify('comment_moderation_assessments', 'archived_comment_moderation_assessments', self::ASSESSMENT_FIELDS);
        $this->verify('comment_moderation_feedback', 'archived_comment_moderation_feedback', self::FEEDBACK_FIELDS);
    }

    private function copyFields(object $row, array $fields): array
    {
        $copy = [];
        foreach ($fields as $field) {
            $copy[$field] = $row->$field;
        }

        return $copy;
    }

    private function fingerprint(object $row, array $fields): string
    {
        return hash('sha256', json_encode($this->copyFields($row, $fields), JSON_THROW_ON_ERROR));
    }

    private function verify(string $source, string $archive, array $fields): void
    {
        if (DB::table($source)->count() !== DB::table($archive)->count()) {
            throw new RuntimeException("Archive row count mismatch for {$source}.");
        }
        DB::table($source)->orderBy('id')->chunkById(100, function ($rows) use ($archive, $fields) {
            foreach ($rows as $row) {
                $saved = DB::table($archive)->where('id', $row->id)->first();
                if (! $saved || ! hash_equals($this->fingerprint($row, $fields), $saved->source_sha256)
                    || ! hash_equals($saved->source_sha256, $this->fingerprint($saved, $fields))) {
                    throw new RuntimeException("Archive row mismatch for {$archive} ID {$row->id}.");
                }
            }
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Archived moderation records are immutable and cannot be discarded by rollback.');
    }
};
