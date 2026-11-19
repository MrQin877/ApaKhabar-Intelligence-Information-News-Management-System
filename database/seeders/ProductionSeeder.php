<?php

namespace Database\Seeders;

use App\Models\BroadcastCategory;
use App\Models\Channel;
use App\Models\Email;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('production') || $this->command === null
            || ! defined('STDIN') || ! stream_isatty(STDIN)) {
            throw new RuntimeException('Run this seeder interactively in production.');
        }

        if (User::exists()) {
            throw new RuntimeException('Accounts already exist. No accounts or passwords were changed.');
        }

        $name = trim((string) $this->command->ask('Administrator name', 'Admin'));
        $email = trim((string) $this->command->ask('Administrator email'));
        if ($name === '' || mb_strlen($name) > 255 || strlen($email) > 255
            || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Enter a valid administrator name and email.');
        }

        // Disable visible-input fallback: never put a bootstrap password in logs/history.
        $password = (string) $this->command->secret('Administrator password (12-72 bytes)', false);
        $confirmation = (string) $this->command->secret('Confirm administrator password', false);
        if (strlen($password) < 12 || strlen($password) > 72
            || trim($password) === '' || ! hash_equals($password, $confirmation)) {
            throw new RuntimeException('Passwords must match and contain 12-72 bytes. No data was seeded.');
        }

        DB::transaction(function () use ($name, $email, $password): void {
            if (User::exists() || Email::where('email', $email)->exists()) {
                throw new RuntimeException('Accounts already exist. No accounts or passwords were changed.');
            }

            foreach (['admin', 'moderator', 'villager'] as $role) {
                UserRole::firstOrCreate(['name' => $role]);
            }
            foreach (['pengumuman', 'darurat'] as $category) {
                BroadcastCategory::firstOrCreate(['name' => $category]);
            }
            foreach (['whatsapp', 'sms', 'aplikasi'] as $channel) {
                Channel::firstOrCreate(['name' => $channel]);
            }

            $user = User::create([
                'name' => $name,
                'roleID' => UserRole::where('name', 'admin')->firstOrFail()->getKey(),
                'password' => Hash::make($password),
            ]);
            Email::create([
                'email' => $email,
                'userID' => $user->getKey(),
                'email_verified_at' => now(),
            ]);
        });

        $this->command->info('Basic records and one verified administrator created. No sample accounts or news were added.');
    }
}
