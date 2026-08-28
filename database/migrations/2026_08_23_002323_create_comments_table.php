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
        Schema::create('comments', function (Blueprint $table) {
            $table->id('commentID');
            $table->text('content');
            $table->timestamps();
 
            $table->foreignId('newsID')
                ->constrained('news', 'postID')
                ->cascadeOnDelete();
 
            $table->foreignId('userID')
                ->constrained('users', 'userID')
                ->cascadeOnDelete();
 
            // Self-referencing FK for replies. Nullable = top-level comment.
            $table->foreignId('parentID')
                ->nullable()
                ->constrained('comments', 'commentID')
                ->nullOnDelete();
        });
    }
 
    public function down(): void
    {
        Schema::dropIfExists('comments');
    }
};