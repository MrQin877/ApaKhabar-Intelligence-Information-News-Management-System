<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meta_insight_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('connection_id')->constrained('social_connections')->cascadeOnDelete();
            $table->string('account_id');
            $table->string('metric');
            $table->string('period')->default('day');
            $table->dateTime('period_end');
            $table->unsignedBigInteger('value');
            $table->timestamp('synced_at');
            $table->unique(['connection_id', 'account_id', 'metric', 'period_end'], 'meta_snapshot_unique');
        });
        Schema::table('social_connections', function (Blueprint $table) {
            $table->string('insights_status')->nullable();
            $table->timestamp('insights_synced_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meta_insight_snapshots');
        Schema::table('social_connections', fn (Blueprint $table) => $table->dropColumn(['insights_status', 'insights_synced_at']));
    }
};
