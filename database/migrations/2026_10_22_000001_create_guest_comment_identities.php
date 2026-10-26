<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guest_comment_identities', function (Blueprint $table) {
            $table->id();
            $table->char('token_hash', 64)->unique();
            $table->string('username', 32)->unique();
            $table->timestamps();
        });
        Schema::create('guest_comment_days', function (Blueprint $table) {
            $table->foreignId('guest_id')->constrained('guest_comment_identities')->cascadeOnDelete();
            $table->date('day');
            $table->unsignedTinyInteger('comment_count');
            $table->primary(['guest_id', 'day']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guest_comment_days');
        Schema::dropIfExists('guest_comment_identities');
    }
};
