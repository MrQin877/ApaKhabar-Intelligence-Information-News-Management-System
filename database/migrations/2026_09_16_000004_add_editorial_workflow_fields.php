<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intelligent_news_drafts', function (Blueprint $table) {
            $table->enum('creation_method', ['manual', 'ai'])->default('ai')->index()->after('created_by');
            $table->foreignId('category_id')->nullable()->after('creation_method')
                ->constrained('news_categories', 'categoryID')->nullOnDelete();
            $table->string('image')->nullable()->after('category_id');
        });

        Schema::table('news', function (Blueprint $table) {
            $table->enum('status', ['active', 'archived'])->default('active')->index()->after('postID');
            $table->enum('creation_method', ['manual', 'ai'])->default('manual')->index()->after('status');
            $table->foreignId('created_by')->nullable()->after('creation_method')
                ->constrained('users', 'userID')->nullOnDelete();
        });

        Schema::table('intelligent_news_sessions', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->index()->after('draft_id');
        });
    }

    public function down(): void
    {
        Schema::table('intelligent_news_sessions', function (Blueprint $table) {
            $table->dropColumn('archived_at');
        });

        Schema::table('news', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
            $table->dropColumn(['status', 'creation_method']);
        });

        Schema::table('intelligent_news_drafts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('category_id');
            $table->dropColumn(['creation_method', 'image']);
        });
    }
};
