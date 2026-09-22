<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL auto-commits DDL. Keep this safe to rerun when a later
        // statement fails after this table has already been created.
        if (! Schema::hasTable('intelligence_extraction_requests')) {
            Schema::create('intelligence_extraction_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('document_id')->constrained('intelligence_documents')->cascadeOnDelete();
                $table->foreignId('requested_by')->constrained('users', 'userID')->cascadeOnDelete();
                $table->enum('mode', ['general', 'targeted'])->default('general')->index();
                $table->text('original_prompt')->nullable();
                $table->text('normalized_query')->nullable();
                $table->json('keywords');
                $table->string('model_name')->nullable();
                $table->string('prompt_version', 50)->default('extraction-v2');
                $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending')->index();
                $table->text('error_message')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        // The old composite unique index was also the supporting index for
        // the document foreign key. Give that foreign key its own index first.
        if (! Schema::hasIndex('intelligence_information', 'intelligence_information_document_id_index')) {
            Schema::table('intelligence_information', function (Blueprint $table) {
                $table->index('document_id', 'intelligence_information_document_id_index');
            });
        }

        Schema::table('intelligence_information', function (Blueprint $table) {
            $table->dropUnique(['document_id', 'item_index']);
            $table->foreignId('extraction_request_id')->nullable()->after('document_id')
                ->constrained('intelligence_extraction_requests')->nullOnDelete();
            $table->enum('review_status', ['pending', 'approved', 'rejected'])
                ->default('approved')->index()->after('confidence');
            $table->decimal('quality_score', 5, 2)->nullable()->after('review_status');
            $table->json('quality_breakdown')->nullable()->after('quality_score');
            $table->enum('information_embedding_status', ['pending', 'ready', 'failed'])
                ->default('pending')->index()->after('quality_breakdown');
            $table->foreignId('reviewed_by')->nullable()->after('is_active')
                ->constrained('users', 'userID')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
            $table->unique(['extraction_request_id', 'item_index'], 'information_request_item_unique');
        });

        Schema::create('intelligent_news_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('intelligent_news_sessions')->cascadeOnDelete();
            $table->enum('role', ['user', 'assistant', 'tool', 'system']);
            $table->string('intent', 50)->nullable()->index();
            $table->longText('content')->nullable();
            $table->string('tool_name', 100)->nullable();
            $table->json('payload')->nullable();
            $table->foreignId('draft_version_id')->nullable()
                ->constrained('intelligent_news_draft_versions')->nullOnDelete();
            $table->timestamps();
            $table->index(['session_id', 'created_at']);
        });

        Schema::create('ai_quality_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('draft_id')->constrained('intelligent_news_drafts')->cascadeOnDelete();
            $table->foreignId('draft_version_id')->nullable()
                ->constrained('intelligent_news_draft_versions')->nullOnDelete();
            $table->string('evaluation_version', 50);
            $table->string('evaluator_model')->nullable();
            $table->decimal('overall_score', 5, 2);
            $table->string('quality_label', 30);
            $table->boolean('publish_blocked')->default(false)->index();
            $table->json('dimensions');
            $table->json('claim_checks');
            $table->json('warnings');
            $table->timestamps();
        });

        Schema::table('intelligent_news_draft_versions', function (Blueprint $table) {
            $table->string('revision_source', 30)->default('manual')->after('change_type');
            $table->text('revision_instruction')->nullable()->after('revision_source');
        });
    }

    public function down(): void
    {
        Schema::table('intelligent_news_draft_versions', function (Blueprint $table) {
            $table->dropColumn(['revision_source', 'revision_instruction']);
        });
        Schema::dropIfExists('ai_quality_evaluations');
        Schema::dropIfExists('intelligent_news_messages');
        Schema::table('intelligence_information', function (Blueprint $table) {
            $table->dropUnique('information_request_item_unique');
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropConstrainedForeignId('extraction_request_id');
            $table->dropColumn([
                'review_status', 'quality_score', 'quality_breakdown',
                'information_embedding_status', 'reviewed_at',
            ]);
            $table->unique(['document_id', 'item_index']);
            $table->dropIndex('intelligence_information_document_id_index');
        });
        Schema::dropIfExists('intelligence_extraction_requests');
    }
};
