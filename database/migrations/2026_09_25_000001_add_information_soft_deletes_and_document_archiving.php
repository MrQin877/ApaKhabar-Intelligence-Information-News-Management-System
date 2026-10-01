<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intelligence_documents', function (Blueprint $table) {
            $table->timestamp('archive_after')->nullable()->index()->after('processed_at');
            $table->timestamp('archived_at')->nullable()->index()->after('archive_after');
            $table->softDeletes();
        });
        Schema::table('intelligence_information', function (Blueprint $table) {
            $table->softDeletes();
        });

        DB::table('intelligence_documents')
            ->whereNull('archive_after')
            ->orderBy('id')->chunkById(500, function ($documents) {
                foreach ($documents as $document) {
                    DB::table('intelligence_documents')->where('id', $document->id)->update([
                        'archive_after' => Carbon::parse($document->created_at)->addYearsNoOverflow(3),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('intelligence_information', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
        Schema::table('intelligence_documents', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropIndex(['archived_at']);
            $table->dropIndex(['archive_after']);
            $table->dropColumn(['archive_after', 'archived_at']);
        });
    }
};
