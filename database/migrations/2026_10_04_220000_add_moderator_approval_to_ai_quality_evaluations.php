<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_quality_evaluations', function (Blueprint $table) {
            $table->foreignId('approved_by')->nullable()->constrained('users', 'userID');
            $table->timestamp('approved_at')->nullable();
            $table->text('approval_note')->nullable();
            $table->unsignedInteger('approved_version')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('ai_quality_evaluations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('approved_by');
            $table->dropColumn(['approved_at', 'approval_note', 'approved_version']);
        });
    }
};
