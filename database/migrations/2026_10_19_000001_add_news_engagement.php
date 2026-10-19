<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('news', function (Blueprint $table) {
            $table->unsignedBigInteger('unique_views')->default(0);
        });
        Schema::table('comments', function (Blueprint $table) {
            $table->unsignedBigInteger('userID')->nullable()->change();
            $table->string('guest_name', 80)->nullable();
            $table->string('status', 24)->default('pending_review');
            $table->boolean('ai_flagged')->nullable();
            $table->json('moderation_categories')->nullable();
            $table->string('moderation_reason')->nullable();
            $table->unsignedBigInteger('moderator_id')->nullable();
            $table->timestamp('moderated_at')->nullable();
            $table->string('submission_hash', 64)->nullable()->unique();
            $table->index(['newsID', 'status', 'created_at']);
            $table->index(['status', 'created_at']);
        });
        Schema::create('news_viewers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('news_id')->constrained('news', 'postID')->cascadeOnDelete();
            $table->string('viewer_key', 80);
            $table->timestamp('expires_at')->nullable()->index();
            $table->unique(['news_id', 'viewer_key']);
        });
        Schema::create('news_visits', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->timestamp('expires_at')->index();
        });
        Schema::create('comment_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained('comments', 'commentID')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users', 'userID')->cascadeOnDelete();
            $table->string('reason', 500);
            $table->timestamp('created_at');
            $table->timestamp('resolved_at')->nullable()->index();
            $table->unique(['comment_id', 'user_id']);
        });
        Schema::create('comment_moderation_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained('comments', 'commentID')->cascadeOnDelete();
            $table->unsignedBigInteger('moderator_id')->nullable();
            $table->string('from_status', 24)->nullable();
            $table->string('to_status', 24);
            $table->string('reason', 500);
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comment_moderation_history');
        Schema::dropIfExists('comment_reports');
        Schema::dropIfExists('news_visits');
        Schema::dropIfExists('news_viewers');
        Schema::table('comments', function (Blueprint $table) {
            $table->dropUnique(['submission_hash']);
            $table->dropIndex(['newsID', 'status', 'created_at']);
            $table->dropIndex(['status', 'created_at']);
            $table->dropColumn(['guest_name', 'status', 'ai_flagged', 'moderation_categories', 'moderation_reason', 'moderator_id', 'moderated_at', 'submission_hash']);
        });
        // userID stays nullable so rollback preserves guest comments.
        Schema::table('news', fn (Blueprint $table) => $table->dropColumn('unique_views'));
    }
};
