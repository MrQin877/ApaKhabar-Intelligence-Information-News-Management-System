<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intelligent_news_drafts', fn (Blueprint $table) => $table->string('facebook_post_id')->nullable());
    }

    public function down(): void
    {
        Schema::table('intelligent_news_drafts', fn (Blueprint $table) => $table->dropColumn('facebook_post_id'));
    }
};
