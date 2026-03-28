<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $driver = Schema::getConnection()->getDriverName();

            if ($driver === 'mongodb') {
                $table->string('phone')->nullable();
                $table->timestamp('phone_verified_at')->nullable();
                $table->string('phone_otp')->nullable();
                $table->timestamp('phone_otp_expires_at')->nullable();
            } else {
                $table->after('password', function (Blueprint $table) {
                    $table->string('phone')->nullable();
                    $table->timestamp('phone_verified_at')->nullable();
                    $table->string('phone_otp')->nullable();
                    $table->timestamp('phone_otp_expires_at')->nullable();
                });
            }
        });

        // ── Add unique sparse index for phone (MongoDB only) ──
        if (Schema::getConnection()->getDriverName() === 'mongodb') {
            DB::connection('mongodb')
                ->getCollection('users')
                ->createIndex(
                    ['phone' => 1],
                    [
                        'unique' => true,
                        'sparse' => true,  // ← allows multiple null phones
                        'name'   => 'users_phone_unique',
                    ]
                );
        }
    }

    public function down(): void
    {
        // ── Drop index first ──
        if (Schema::getConnection()->getDriverName() === 'mongodb') {
            try {
                DB::connection('mongodb')
                    ->getCollection('users')
                    ->dropIndex('users_phone_unique');
            } catch (\Exception $e) {
                // Index might not exist
            }
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'phone',
                'phone_verified_at',
                'phone_otp',
                'phone_otp_expires_at',
            ]);
        });
    }
};