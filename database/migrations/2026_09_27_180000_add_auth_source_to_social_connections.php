<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('social_connections', function (Blueprint $table) {
            $table->string('auth_source', 32)->nullable();
        });

        // Existing Instagram tokens were issued by direct Instagram Login.
        DB::table('social_connections')->where('platform', 'instagram')->update(['auth_source' => 'instagram_login']);
        DB::table('social_connections')->where('platform', 'facebook')->update(['auth_source' => 'facebook_login']);
    }

    public function down(): void
    {
        Schema::table('social_connections', fn (Blueprint $table) => $table->dropColumn('auth_source'));
    }
};
