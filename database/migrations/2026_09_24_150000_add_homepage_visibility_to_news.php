<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['news', 'intelligent_news_drafts'] as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->boolean('show_on_homepage')->default(true);
            });
        }
    }

    public function down(): void
    {
        foreach (['news', 'intelligent_news_drafts'] as $table) {
            Schema::table($table, fn (Blueprint $table) => $table->dropColumn('show_on_homepage'));
        }
    }
};
