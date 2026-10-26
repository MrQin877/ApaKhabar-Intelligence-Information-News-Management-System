<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('short_videos', function (Blueprint $table) {
            $table->unsignedBigInteger('view_count')->default(0);
        });

        Schema::create('short_video_viewers', function (Blueprint $table) {
            $table->foreignId('short_video_id')->constrained()->cascadeOnDelete();
            $table->string('viewer_key', 71);
            $table->timestamp('viewed_at');
            $table->primary(['short_video_id', 'viewer_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('short_video_viewers');
        Schema::table('short_videos', function (Blueprint $table) {
            $table->dropColumn('view_count');
        });
    }
};
