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
        Schema::create('phones', function (Blueprint $table) {
            $table->string('phone')->primary();
            $table->string('phone_otp')->nullable();
            $table->timestamp('phone_otp_expires_at')->nullable();
            $table->timestamp('phone_verified_at')->nullable();
            $table->timestamps();
 
            $table->foreignId('userID')
                ->unique()
                ->constrained('users', 'userID')
                ->cascadeOnDelete();
        });
    }
 
    public function down(): void
    {
        Schema::dropIfExists('phones');
    }
};