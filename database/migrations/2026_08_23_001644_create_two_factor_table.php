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
        Schema::create('two_factors', function (Blueprint $table) {
            $table->string('two_factor_secret')->primary();
            $table->text('two_factor_recovery_codes')->nullable();
            $table->timestamp('two_factor_confirmed_at')->nullable();
            $table->timestamps();
 
            $table->foreignId('userID')
                ->unique()
                ->constrained('users', 'userID')
                ->cascadeOnDelete();
        });
    }
 
    public function down(): void
    {
        Schema::dropIfExists('two_factors');
    }
};