<?php

use App\Models\User;

test('mobile name update changes only the authenticated name and preserves verified email', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $original = $user->only(['email', 'email_verified_at', 'password', 'roleID']);
    $otherName = $other->name;

    $this->withToken($user->createToken('name-test')->plainTextToken)
        ->patchJson('/api/profile/name', ['name' => '  Nama Baru  ', 'user_id' => $other->id, 'email' => 'ignored@example.test'])
        ->assertOk()->assertJsonPath('name', 'Nama Baru')->assertJsonPath('id', (string) $user->id);

    expect($user->fresh()->name)->toBe('Nama Baru')
        ->and($user->fresh()->only(array_keys($original)))->toEqual($original)
        ->and($other->fresh()->name)->toBe($otherName);
    $this->getJson('/api/profile')->assertOk()->assertJsonPath('name', 'Nama Baru');
});

test('phone-only accounts can update their name without adding an email', function () {
    $user = User::factory()->create();
    $user->emailRecord()->delete();
    $this->withToken($user->createToken('name-test')->plainTextToken)
        ->patchJson('/api/profile/name', ['name' => 'Warga Punggul'])
        ->assertOk()->assertJsonPath('name', 'Warga Punggul')->assertJsonPath('email', null);
    expect($user->emailRecord()->exists())->toBeFalse();
});

test('invalid names cannot overwrite the saved name', function ($name) {
    $user = User::factory()->create();
    $original = $user->name;
    $this->withToken($user->createToken('name-test')->plainTextToken)
        ->patchJson('/api/profile/name', ['name' => $name])
        ->assertUnprocessable()->assertJsonValidationErrors('name');
    expect($user->fresh()->name)->toBe($original);
})->with([
    'null' => [null],
    'empty' => [''],
    'whitespace' => ['   '],
    'too long' => [str_repeat('a', 256)],
    'array' => [['invalid']],
]);

test('name changes require authentication', function () {
    $this->patchJson('/api/profile/name', ['name' => 'Unauthorised'])->assertUnauthorized();
});
