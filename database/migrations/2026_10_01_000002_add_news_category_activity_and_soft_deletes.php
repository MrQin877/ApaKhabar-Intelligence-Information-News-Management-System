<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('news_categories', function (Blueprint $table): void {
            $table->boolean('is_active')->default(true)->index();
            $table->softDeletes();
        });
        DB::table('news_categories')->where('status', 'inactive')->update(['is_active' => false]);
    }

    public function down(): void
    {
        Schema::table('news_categories', function (Blueprint $table): void {
            $table->dropIndex(['is_active']);
            $table->dropColumn(['is_active', 'deleted_at']);
        });
    }
};
