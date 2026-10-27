<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('analytics_settings', 'layout')) {
            Schema::table('analytics_settings', function (Blueprint $table) {
                $table->json('layout')->nullable();
            });
        }

        // Older installations stored layouts only in the audit history.
        if (DB::table('analytics_settings')->where('id', 1)->value('layout') === null) {
            foreach (DB::table('analytics_setting_changes')->orderByDesc('id')->cursor() as $change) {
                $configuration = json_decode($change->configuration, true);
                if (is_array($configuration['layout'] ?? null)) {
                    DB::table('analytics_settings')->where('id', 1)->update([
                        'layout' => json_encode($configuration['layout']),
                    ]);
                    break;
                }
            }
        }
    }

    public function down(): void
    {
        // Preserve layout data: the original analytics migration owns this column.
    }
};
