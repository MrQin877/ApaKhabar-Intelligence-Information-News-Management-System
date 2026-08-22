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
        Schema::create('notifications', function (Blueprint $table) {
            $table->id('notificationID');
            $table->string('type');
            $table->text('data')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
 
            // Despite the polymorphic-sounding name, this is a direct FK to users.
            $table->foreignId('notifiable_id')
                ->constrained('users', 'userID')
                ->cascadeOnDelete();
            $table->string('notifiable_type')->default('App\\Models\\User');
 
            // Optional links back to whatever triggered the notification.
            $table->foreignId('alertID')
                ->nullable()
                ->constrained('broadcasts', 'alertID')
                ->nullOnDelete();
 
            $table->foreignId('postID')
                ->nullable()
                ->constrained('news', 'postID')
                ->nullOnDelete();
 
            $table->foreignId('commentID')
                ->nullable()
                ->constrained('comments', 'commentID')
                ->nullOnDelete();
        });
    }
 
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};