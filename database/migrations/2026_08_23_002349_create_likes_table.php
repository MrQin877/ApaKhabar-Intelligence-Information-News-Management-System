<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('likes', function (Blueprint $table) {
            $table->id('likeID');
            $table->timestamp('created_at')->useCurrent();
 
            $table->foreignId('postID')
                ->constrained('news', 'postID')
                ->cascadeOnDelete();
 
            $table->foreignId('userID')
                ->constrained('users', 'userID')
                ->cascadeOnDelete();
 
            $table->unique(['postID', 'userID']);
        });
    }
 
    public function down(): void
    {
        Schema::dropIfExists('likes');
    }
};