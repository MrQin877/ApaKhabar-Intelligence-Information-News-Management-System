<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $ids = DB::table('news_categories')->whereRaw('LOWER(TRIM(name)) = ?', ['lainnya'])->pluck('categoryID');
            DB::table('news')->whereIn('category_id', $ids)->update(['category_id' => null]);
            DB::table('intelligent_news_drafts')->whereIn('category_id', $ids)->update(['category_id' => null]);
            DB::table('news_categories')->whereIn('categoryID', $ids)->delete();
        });
    }

    public function down(): void
    {
        // This intentional data cleanup cannot reconstruct previous category assignments.
    }
};
