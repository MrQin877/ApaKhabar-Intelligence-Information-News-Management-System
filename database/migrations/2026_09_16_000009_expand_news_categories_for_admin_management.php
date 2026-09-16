<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('news_categories', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('name');
            $table->enum('status', ['active', 'inactive'])->default('active')->index()->after('description');
            $table->unsignedInteger('display_order')->default(0)->index()->after('status');
            $table->boolean('is_default')->default(false)->index()->after('display_order');
            $table->foreignId('created_by')->nullable()->after('is_default')
                ->constrained('users', 'userID')->nullOnDelete();
        });

        DB::table('news_categories')->orderBy('categoryID')->get()->each(function ($category) {
            $base = Str::slug($category->name) ?: 'category';
            $slug = $base;
            $suffix = 2;
            while (DB::table('news_categories')->where('slug', $slug)->exists()) {
                $slug = $base.'-'.$suffix++;
            }
            DB::table('news_categories')->where('categoryID', $category->categoryID)->update(['slug' => $slug]);
        });

        if (! DB::table('news_categories')->whereRaw('LOWER(name) = ?', ['lainnya'])->exists()) {
            DB::table('news_categories')->insert([
                'name' => 'Lainnya', 'slug' => 'lainnya',
                'description' => 'Kategori bawaan untuk berita yang tidak sesuai kategori lain.',
                'status' => 'active', 'display_order' => 999, 'is_default' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        } else {
            DB::table('news_categories')->whereRaw('LOWER(name) = ?', ['lainnya'])->update(['is_default' => true]);
        }

        Schema::table('news_categories', fn (Blueprint $table) => $table->unique('slug'));
    }

    public function down(): void
    {
        Schema::table('news_categories', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropUnique(['slug']);
            $table->dropColumn(['slug', 'status', 'display_order', 'is_default', 'created_by']);
        });
    }
};
