<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('short_videos', function (Blueprint $t) {
            $t->id();
            $t->foreignId('created_by')->constrained('users', 'userID');
            $t->string('title')->default('');
            $t->text('description')->nullable();
            $t->text('video_url');
            $t->string('video_public_id');
            $t->text('thumbnail_url');
            $t->string('thumbnail_public_id')->nullable();
            $t->decimal('frame_offset', 10, 3)->default(0);
            $t->json('metadata');
            $t->string('status')->default('draft')->index();
            $t->timestamp('published_at')->nullable()->index();
            $t->timestamps();
            $t->softDeletes();
        });
        Schema::create('short_video_publications', function (Blueprint $t) {
            $t->id();
            $t->foreignId('short_video_id')->constrained()->cascadeOnDelete();
            $t->string('platform');
            $t->foreignId('connection_id')->nullable()->constrained('social_connections')->nullOnDelete();
            $t->string('account_id')->nullable();
            $t->string('account_name')->nullable();
            $t->string('graph_host')->nullable();
            $t->string('graph_version')->nullable();
            $t->text('credential')->nullable();
            $t->timestamp('credential_expires_at')->nullable();
            $t->string('container_id')->nullable();
            $t->string('media_id')->nullable();
            $t->text('permalink')->nullable();
            $t->string('status')->default('queued')->index();
            $t->string('stage')->default('create');
            $t->timestamp('locked_until')->nullable();
            $t->unsignedInteger('attempts')->default(0);
            $t->unsignedInteger('polls')->default(0);
            $t->text('error_summary')->nullable();
            $t->timestamp('next_attempt_at')->nullable()->index();
            $t->timestamp('published_at')->nullable();
            $t->timestamps();
            $t->unique(['short_video_id', 'platform']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('short_video_publications');
        Schema::dropIfExists('short_videos');
    }
};
