<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL/MariaDB DDL is not transactional: a previous attempt may have added this column.
        if (! Schema::hasColumn('comments', 'moderation_revision')) {
            Schema::table('comments', function (Blueprint $table) {
                $table->unsignedInteger('moderation_revision')->default(0);
            });
        }

        Schema::create('comment_moderation_assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->unique()->constrained('comments', 'commentID')->cascadeOnDelete();
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
        });

        Schema::create('comment_moderation_feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained('comments', 'commentID')->cascadeOnDelete();
            $table->foreignId('assessment_id')->constrained('comment_moderation_assessments')->cascadeOnDelete();
            $table->foreignId('history_id')->unique()->constrained('comment_moderation_history')->cascadeOnDelete();
            $table->foreignId('administrator_id')->nullable()->constrained('users', 'userID')->nullOnDelete();
            $table->string('classification', 24);
            $table->string('category', 40);
            $table->string('explanation', 1000)->nullable();
            $table->string('verification_status', 24)->default('unverified');
            $table->uuid('request_id')->unique();
            $table->unsignedInteger('expected_revision');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['comment_id', 'created_at']);
            $table->index(['verification_status', 'created_at']);
        });

        // Explicit DEFAULT without ON UPDATE keeps existing audit dates stable on MariaDB.
        Schema::table('comment_moderation_history', function (Blueprint $table) {
            $table->timestamp('created_at')->useCurrent()->change();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comment_moderation_feedback');
        Schema::dropIfExists('comment_moderation_assessments');
        Schema::table('comments', fn (Blueprint $table) => $table->dropColumn('moderation_revision'));
    }
};
