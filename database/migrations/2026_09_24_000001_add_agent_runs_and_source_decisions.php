<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intelligent_news_sessions', function (Blueprint $table) {
            $table->string('title')->nullable()->after('status');
            $table->longText('context_summary')->nullable()->after('prompt');
            $table->string('current_intent', 50)->nullable()->after('context_summary');
            $table->timestamp('last_message_at')->nullable()->index()->after('archived_at');
        });

        Schema::table('intelligent_news_messages', function (Blueprint $table) {
            $table->foreignId('reply_to_id')->nullable()->after('session_id')
                ->constrained('intelligent_news_messages')->nullOnDelete();
            $table->enum('status', ['pending', 'completed', 'failed'])
                ->default('completed')->index()->after('role');
            $table->unsignedInteger('sequence')->default(0)->after('status');
            $table->index(['session_id', 'sequence'], 'news_message_session_sequence_index');
        });

        Schema::create('intelligent_news_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('intelligent_news_sessions')->cascadeOnDelete();
            $table->foreignId('user_message_id')->nullable()
                ->constrained('intelligent_news_messages')->nullOnDelete();
            $table->string('intent', 50)->index();
            $table->enum('status', ['queued', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled'])
                ->default('queued')->index();
            $table->string('current_stage', 80)->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['session_id', 'created_at']);
        });

        Schema::create('intelligent_news_run_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('run_id')->constrained('intelligent_news_runs')->cascadeOnDelete();
            $table->unsignedInteger('sequence');
            $table->string('event_type', 50)->index();
            $table->string('tool_name', 100)->nullable();
            $table->string('label')->nullable();
            $table->longText('content')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();
            $table->unique(['run_id', 'sequence']);
        });

        Schema::create('intelligent_news_source_selections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('intelligent_news_sessions')->cascadeOnDelete();
            $table->foreignId('message_id')->nullable()
                ->constrained('intelligent_news_messages')->nullOnDelete();
            $table->foreignId('run_id')->nullable()
                ->constrained('intelligent_news_runs')->nullOnDelete();
            $table->enum('source_type', ['information', 'document', 'web']);
            $table->foreignId('information_id')->nullable()
                ->constrained('intelligence_information')->nullOnDelete();
            $table->foreignId('document_id')->nullable()
                ->constrained('intelligence_documents')->nullOnDelete();
            $table->text('url')->nullable();
            $table->string('title');
            $table->json('source_snapshot')->nullable();
            $table->enum('decision', ['pending', 'approved', 'rejected'])->default('pending')->index();
            $table->foreignId('decided_by')->nullable()
                ->constrained('users', 'userID')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
            $table->index(['session_id', 'source_type', 'decision'], 'news_source_session_type_decision');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intelligent_news_source_selections');
        Schema::dropIfExists('intelligent_news_run_events');
        Schema::dropIfExists('intelligent_news_runs');

        Schema::table('intelligent_news_messages', function (Blueprint $table) {
            $table->dropIndex('news_message_session_sequence_index');
            $table->dropConstrainedForeignId('reply_to_id');
            $table->dropColumn(['status', 'sequence']);
        });

        Schema::table('intelligent_news_sessions', function (Blueprint $table) {
            $table->dropColumn(['title', 'context_summary', 'current_intent', 'last_message_at']);
        });
    }
};
