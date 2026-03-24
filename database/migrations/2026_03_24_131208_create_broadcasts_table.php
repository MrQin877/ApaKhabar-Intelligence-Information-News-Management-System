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
        Schema::create('broadcasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('message');
            $table->enum('category', ['pengumuman', 'darurat']);
            $table->json('channels');           // ["whatsapp", "sms", "aplikasi"]
            $table->enum('audience', ['semua', 'karyawan']);
            $table->enum('status', ['dikirim', 'terjadwal', 'tertunda'])->default('tertunda');
            $table->enum('send_mode', ['now', 'scheduled'])->default('now');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('broadcasts');
    }
};
