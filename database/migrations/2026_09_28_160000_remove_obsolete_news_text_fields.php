<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Superseded by 2026_09_29_180000_unify_draft_article_columns.
        // Preserve subheadline and summary for that migration to convert into
        // content and excerpt. Published news still uses its excerpt column.
        // Keep this migration as a no-op for databases where it is pending.
    }

    public function down(): void
    {
        // No schema changes to reverse. The unification migration owns them.
    }
};
