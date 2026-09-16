<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intelligent_news_sessions', function (Blueprint $table) {
            $table->unsignedTinyInteger('clarification_rounds')->default(0)->after('conflicts');
        });
    }

    public function down(): void
    {
        Schema::table('intelligent_news_sessions', function (Blueprint $table) {
            $table->dropColumn('clarification_rounds');
        });
    }
};
