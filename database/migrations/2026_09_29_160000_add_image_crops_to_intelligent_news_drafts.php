<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intelligent_news_drafts', function (Blueprint $table) {
            $table->json('image_crops')->nullable();
            $table->json('image_variants')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('intelligent_news_drafts', function (Blueprint $table) {
            $table->dropColumn(['image_crops', 'image_variants']);
        });
    }
};
