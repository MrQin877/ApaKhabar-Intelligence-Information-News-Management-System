<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intelligent_news_drafts', function (Blueprint $table) {
            $table->json('publication_results')->nullable();
            $table->timestamp('publication_started_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('intelligent_news_drafts', function (Blueprint $table) {
            $table->dropColumn(['publication_results', 'publication_started_at']);
        });
    }
};
