<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

test('the first web reset submission returns explicit success and consumes the token', function () {
    $user = User::factory()->create();
    $payload = [
        'email' => $user->email, 'token' => Password::createToken($user),
        'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!',
    ];
    $this->postJson('/reset-password', $payload)->assertOk()->assertJsonStructure(['message']);
    expect(Hash::check('NewPassword123!', $user->fresh()->password))->toBeTrue();
    $this->postJson('/reset-password', $payload)->assertUnprocessable()->assertJsonValidationErrors('email');
});

test('a failed first reset response preserves the token so corrected input can succeed', function () {
    $user = User::factory()->create();
    $payload = [
        'email' => $user->email, 'token' => Password::createToken($user),
        'password' => 'NewPassword123!', 'password_confirmation' => 'DoesNotMatch123!',
    ];
    $this->postJson('/reset-password', $payload)->assertUnprocessable()->assertJsonValidationErrors('password');
    expect(Hash::check('password', $user->fresh()->password))->toBeTrue();
    $this->postJson('/reset-password', [...$payload, 'password_confirmation' => 'NewPassword123!'])
        ->assertOk()->assertJsonStructure(['message']);
});
