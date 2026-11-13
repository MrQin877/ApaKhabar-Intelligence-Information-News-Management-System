<?php

namespace Database\Seeders;

use App\Models\BroadcastCategory;
use App\Models\Channel;
use App\Models\Email;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        foreach (['admin', 'moderator', 'villager'] as $role) {
            UserRole::firstOrCreate(['name' => $role]);
        }

        foreach (['pengumuman', 'darurat'] as $category) {
            BroadcastCategory::firstOrCreate(['name' => $category]);
        }

        foreach (['whatsapp', 'sms', 'aplikasi'] as $channel) {
            Channel::firstOrCreate(['name' => $channel]);
        }

        $accounts = [
            ['name' => 'Admin', 'email' => 'noreply.apakhabar@gmail.com', 'role' => 'admin', 'password' => 'Ap@Kh@6ar!'],
            ['name' => 'Moderator', 'email' => 'moderator@apakhabar.test', 'role' => 'moderator', 'password' => 'Mod@Kh@6ar!'],
            ['name' => 'Test User', 'email' => 'test@apakhabar.test', 'role' => 'villager', 'password' => 'password'],
        ];

        foreach ($accounts as $account) {
            $role = UserRole::where('name', $account['role'])->firstOrFail();
            $emailRecord = Email::where('email', $account['email'])->first();

            // Preserve the existing admin reset behavior; keep new accounts repeatable.
            if ($emailRecord) {
                if ($emailRecord->email_verified_at === null) {
                    $emailRecord->update(['email_verified_at' => now()]);
                }

                if ($account['role'] === 'admin') {
                    $emailRecord->user->update([
                        'name' => $account['name'],
                        'roleID' => $role->getKey(),
                        'password' => Hash::make($account['password']),
                    ]);
                }

                continue;
            }

            $user = User::create([
                'name' => $account['name'],
                'roleID' => $role->getKey(),
                'password' => Hash::make($account['password']),
            ]);

            Email::create([
                'email' => $account['email'],
                'userID' => $user->getKey(),
                'email_verified_at' => now(),
            ]);
        }
    }
}
