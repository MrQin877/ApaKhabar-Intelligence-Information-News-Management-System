<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('intelligent_news_draft_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('draft_id')->constrained('intelligent_news_drafts')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('change_type', 30);
            $table->json('snapshot');
            $table->foreignId('created_by')->constrained('users', 'userID')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['draft_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intelligent_news_draft_versions');
    }
};
