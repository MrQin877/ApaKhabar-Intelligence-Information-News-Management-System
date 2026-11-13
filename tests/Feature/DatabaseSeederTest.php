<?php

use App\Models\Email;
use App\Models\News;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

test('default seeding creates staff without sample news and preserves the moderator on rerun', function () {
    $this->seed(DatabaseSeeder::class);

    $moderator = Email::where('email', 'moderator@apakhabar.test')->firstOrFail()->user;
    expect($moderator->roleRecord->name)->toBe('moderator');
    expect(Hash::check('Mod@Kh@6ar!', $moderator->password))->toBeTrue();
    expect(News::count())->toBe(0);
    expect(User::count())->toBe(3);

    $moderator->update(['password' => Hash::make('changed-password')]);
    $this->seed(DatabaseSeeder::class);

    expect(User::count())->toBe(3);
    expect(Email::count())->toBe(3);
    expect(News::count())->toBe(0);
    expect(Hash::check('changed-password', $moderator->fresh()->password))->toBeTrue();
});


test('seed accounts are verified on creation and existing unverified accounts are repaired', function () {
    $this->seed(DatabaseSeeder::class);

    foreach (User::all() as $user) {
        expect($user->hasVerifiedEmail())->toBeTrue();
    }

    $adminEmail = Email::where('email', 'noreply.apakhabar@gmail.com')->firstOrFail();
    $originalVerifiedAt = $adminEmail->email_verified_at->toDateTimeString();
    Email::where('email', '!=', $adminEmail->email)->update(['email_verified_at' => null]);
    $this->travel(1)->hours();
    $this->seed(DatabaseSeeder::class);

    foreach (User::all() as $user) {
        expect($user->hasVerifiedEmail())->toBeTrue();
    }
    expect($adminEmail->fresh()->email_verified_at->toDateTimeString())->toBe($originalVerifiedAt);
});
