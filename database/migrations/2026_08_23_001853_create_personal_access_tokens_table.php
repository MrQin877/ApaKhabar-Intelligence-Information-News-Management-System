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
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id('tokenID');

            $table->foreignId('tokenable_id')
                ->constrained('users', 'userID')
                ->restrictOnDelete();

            $table->string('tokenable_type');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['tokenable_type', 'tokenable_id']);
        });
    }
 
    public function down(): void
    {
        Schema::dropIfExists('personal_access_tokens');
    }
};