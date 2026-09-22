<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('intelligent_news_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users', 'userID')->cascadeOnDelete();
            $table->enum('status', [
                'collecting_sources', 'processing_files', 'awaiting_answers',
                'ready_to_generate', 'draft_generated',
            ])->default('collecting_sources')->index();
            $table->text('prompt')->nullable();
            $table->json('selected_document_ids');
            $table->json('selected_information_ids');
            $table->json('user_facts');
            $table->json('pending_questions');
            $table->json('conflicts');
            $table->foreignId('draft_id')->nullable()->constrained('intelligent_news_drafts')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intelligent_news_sessions');
    }
};
