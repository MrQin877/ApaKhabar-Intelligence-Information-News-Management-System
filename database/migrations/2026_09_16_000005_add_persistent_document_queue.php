<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jobs', function (Blueprint $table) {
            $table->id();
            $table->string('queue')->index();
            $table->longText('payload');
            $table->unsignedTinyInteger('attempts');
            $table->unsignedInteger('reserved_at')->nullable();
            $table->unsignedInteger('available_at');
            $table->unsignedInteger('created_at');
        });

        Schema::create('failed_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestamp('failed_at')->useCurrent();
        });

        Schema::table('intelligence_documents', function (Blueprint $table) {
            $table->unsignedInteger('processing_attempts')->default(0)->after('embedding_status');
            $table->timestamp('last_attempted_at')->nullable()->index()->after('processing_attempts');
        });
    }

    public function down(): void
    {
        Schema::table('intelligence_documents', function (Blueprint $table) {
            $table->dropColumn(['processing_attempts', 'last_attempted_at']);
        });
        Schema::dropIfExists('failed_jobs');
        Schema::dropIfExists('jobs');
    }
};
