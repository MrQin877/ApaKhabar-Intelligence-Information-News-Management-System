<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intelligence_documents', function (Blueprint $table) {
            if (! Schema::hasColumn('intelligence_documents', 'storage_disk')) {
                $table->string('storage_disk', 50)->default('local')->after('original_name');
            }
            if (! Schema::hasColumn('intelligence_documents', 'embedding_status')) {
                $table->enum('embedding_status', ['pending', 'ready', 'failed'])
                    ->default('pending')->index()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('intelligence_documents', function (Blueprint $table) {
            if (Schema::hasColumn('intelligence_documents', 'embedding_status')) {
                $table->dropColumn('embedding_status');
            }
            if (Schema::hasColumn('intelligence_documents', 'storage_disk')) {
                $table->dropColumn('storage_disk');
            }
        });
    }
};
