<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->date('date_of_birth')->nullable();
            $table->string('citizenship', 16)->nullable();
            $table->string('gender', 16)->nullable();
            $table->string('ethnicity', 100)->nullable();
        });
        Schema::create('analytics_settings', function (Blueprint $table) {
            $table->id();
            $table->json('widgets');
            $table->json('layout')->nullable();
            $table->json('meta_connection_ids')->nullable();
            $table->unsignedSmallInteger('period_days')->default(30);
            $table->foreignId('updated_by')->nullable()->constrained('users', 'userID')->nullOnDelete();
            $table->timestamp('tracking_started_at');
            $table->timestamps();
        });
        DB::table('analytics_settings')->insert(['id' => 1, 'widgets' => json_encode(['categories', 'activity']), 'period_days' => 30, 'tracking_started_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        Schema::create('analytics_setting_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users', 'userID')->nullOnDelete();
            $table->json('configuration');
            $table->timestamp('created_at');
        });
        Schema::create('villager_activity_hours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users', 'userID')->cascadeOnDelete();
            $table->dateTime('hour');
            $table->string('platform', 8);
            $table->unique(['user_id', 'hour', 'platform']);
            $table->index('hour');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('villager_activity_hours');
        Schema::dropIfExists('analytics_setting_changes');
        Schema::dropIfExists('analytics_settings');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['date_of_birth', 'citizenship', 'gender', 'ethnicity']));
    }
};
