<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intelligent_news_drafts', function (Blueprint $table) {
            $table->dropColumn(['subheadline', 'summary']);
        });
        Schema::table('news', function (Blueprint $table) {
            $table->dropColumn('excerpt');
        });
    }

    public function down(): void
    {
        Schema::table('intelligent_news_drafts', function (Blueprint $table) {
            $table->string('subheadline')->nullable();
            $table->longText('summary')->nullable();
        });
        Schema::table('news', function (Blueprint $table) {
            $table->text('excerpt')->nullable();
        });
    }
};
