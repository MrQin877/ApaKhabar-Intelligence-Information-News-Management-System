<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('short_videos', function (Blueprint $table) {
            $table->unsignedBigInteger('likes_count')->default(0);
        });
        Schema::create('short_video_likes', function (Blueprint $table) {
            $table->foreignId('short_video_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users', 'userID')->cascadeOnDelete();
            $table->primary(['short_video_id', 'user_id']);
        });
        Schema::create('short_video_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('short_video_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users', 'userID')->nullOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('short_video_comments')->cascadeOnDelete();
            $table->foreignId('root_id')->nullable()->constrained('short_video_comments')->cascadeOnDelete();
            $table->string('guest_name', 80)->nullable();
            $table->text('content');
            $table->string('status', 24)->default('pending_review');
            $table->boolean('ai_flagged')->nullable();
            $table->json('moderation_categories')->nullable();
            $table->string('moderation_reason')->nullable();
            $table->json('moderation_assessment')->nullable();
            $table->foreignId('moderator_id')->nullable()->constrained('users', 'userID')->nullOnDelete();
            $table->timestamp('moderated_at')->nullable();
            $table->unsignedInteger('moderation_revision')->default(0);
            $table->string('submission_hash', 64)->unique();
            $table->timestamps();
            $table->index(['short_video_id', 'status', 'root_id', 'created_at'], 'short_comments_public_index');
        });
        Schema::create('short_video_comment_likes', function (Blueprint $table) {
            $table->foreignId('comment_id')->constrained('short_video_comments')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users', 'userID')->cascadeOnDelete();
            $table->primary(['comment_id', 'user_id']);
        });
        Schema::create('short_video_comment_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained('short_video_comments')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users', 'userID')->cascadeOnDelete();
            $table->string('reason', 500);
            $table->timestamp('created_at');
            $table->timestamp('resolved_at')->nullable()->index();
            $table->unique(['comment_id', 'user_id']);
        });
        Schema::create('short_video_comment_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained('short_video_comments')->cascadeOnDelete();
            $table->foreignId('moderator_id')->constrained('users', 'userID')->cascadeOnDelete();
            $table->string('category', 80);
            $table->string('explanation', 1000)->nullable();
            $table->timestamp('created_at');
            $table->timestamp('resolved_at')->nullable()->index();
        });
        Schema::create('short_video_comment_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained('short_video_comments')->cascadeOnDelete();
            $table->foreignId('moderator_id')->nullable()->constrained('users', 'userID')->nullOnDelete();
            $table->string('from_status', 24)->nullable();
            $table->string('to_status', 24);
            $table->string('reason', 500);
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('short_video_comment_history');
        Schema::dropIfExists('short_video_comment_flags');
        Schema::dropIfExists('short_video_comment_reports');
        Schema::dropIfExists('short_video_comment_likes');
        Schema::dropIfExists('short_video_comments');
        Schema::dropIfExists('short_video_likes');
        Schema::table('short_videos', fn (Blueprint $table) => $table->dropColumn('likes_count'));
    }
};
