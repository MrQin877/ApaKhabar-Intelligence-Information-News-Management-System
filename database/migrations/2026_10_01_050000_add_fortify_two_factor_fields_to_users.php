<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Fortify persists these fields on its authenticatable User model.
        Schema::table('users', function (Blueprint $table) {
            $table->text('two_factor_secret')->nullable();
            $table->text('two_factor_recovery_codes')->nullable();
            $table->timestamp('two_factor_confirmed_at')->nullable();
        });
        // Preserve any enrollment stored by the earlier relational schema.
        DB::table('two_factors')->orderBy('userID')->chunk(100, function ($rows) {
            foreach ($rows as $row) {
                DB::table('users')->where('userID', $row->userID)->update([
                    'two_factor_secret' => $row->two_factor_secret,
                    'two_factor_recovery_codes' => $row->two_factor_recovery_codes,
                    'two_factor_confirmed_at' => $row->two_factor_confirmed_at,
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at']);
        });
    }
};
