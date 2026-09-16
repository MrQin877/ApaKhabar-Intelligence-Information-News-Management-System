<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('intelligence_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('uploaded_by')->constrained('users', 'userID')->cascadeOnDelete();
            $table->uuid('ai_document_id')->nullable()->unique();
            $table->string('original_name');
            $table->string('storage_disk', 50)->default('local');
            $table->string('storage_path');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size');
            $table->string('sha256', 64)->index();
            $table->enum('status', ['processing', 'ready', 'failed'])->default('processing')->index();
            $table->enum('embedding_status', ['pending', 'ready', 'failed'])->default('pending')->index();
            $table->unsignedInteger('character_count')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('intelligence_information', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('intelligence_documents')->cascadeOnDelete();
            $table->unsignedInteger('item_index');
            $table->string('type', 50);
            $table->string('title');
            $table->longText('summary');
            $table->json('labels');
            $table->json('fields');
            $table->json('evidence');
            $table->decimal('confidence', 5, 4)->nullable();
            $table->longText('search_text');
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->unique(['document_id', 'item_index']);
            $table->index(['type', 'created_at']);
        });

        Schema::create('intelligent_news_drafts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users', 'userID')->cascadeOnDelete();
            $table->string('headline');
            $table->string('subheadline')->nullable();
            $table->longText('lead');
            $table->json('body');
            $table->longText('summary');
            $table->json('labels');
            $table->json('sources_used');
            $table->json('warnings');
            $table->text('user_prompt')->nullable();
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft')->index();
            $table->foreignId('published_news_id')->nullable()->constrained('news', 'postID')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('intelligent_news_draft_sources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('draft_id')->constrained('intelligent_news_drafts')->cascadeOnDelete();
            $table->foreignId('information_id')->constrained('intelligence_information')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['draft_id', 'information_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intelligent_news_draft_sources');
        Schema::dropIfExists('intelligent_news_drafts');
        Schema::dropIfExists('intelligence_information');
        Schema::dropIfExists('intelligence_documents');
    }
};
