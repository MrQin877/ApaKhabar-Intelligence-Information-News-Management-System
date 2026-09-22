<?php

use App\Actions\Fortify\ResetUserPassword;
use App\Models\User;
use App\Services\Auth\AuthService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

test('password reset preserves email verification through mobile login and profile', function (bool $verified, string $flow) {
    Notification::fake();
    $user = $verified ? User::factory()->create() : User::factory()->unverified()->create();
    $email = $user->email;
    $before = $user->emailRecord->getRawOriginal();
    $timestamp = $user->email_verified_at?->toIso8601String();
    $password = 'NewPassword123!';

    if ($flow === 'mobile') {
        $payload = [
            'token' => Password::createToken($user), 'email' => $email,
            'password' => $password, 'password_confirmation' => $password,
        ];
        $this->postJson('/api/reset-password', $payload)->assertOk();
        $this->postJson('/api/reset-password', $payload)->assertUnprocessable();
    } else {
        app(ResetUserPassword::class)->reset($user, [
            'password' => $password, 'password_confirmation' => $password,
        ]);
    }

    expect($user->fresh()->emailRecord->getRawOriginal())->toBe($before);
    expect(Hash::check($password, $user->fresh()->password))->toBeTrue();
    $this->postJson('/api/login', ['email' => $email, 'password' => 'password'])->assertUnauthorized();
    $login = $this->postJson('/api/login', ['email' => $email, 'password' => $password])
        ->assertOk()->assertJsonPath('user.email_verified_at', $timestamp);
    $this->getJson('/api/profile', ['Authorization' => 'Bearer '.$login->json('token')])
        ->assertOk()->assertJsonPath('email', $email)->assertJsonPath('email_verified_at', $timestamp);
    Notification::assertNothingSent();
})->with([true, false])->with(['mobile', 'web']);

test('profile serialization refreshes a previously loaded email verification record', function () {
    $user = User::factory()->unverified()->create();
    expect($user->email_verified_at)->toBeNull();
    $user->emailRecord()->update(['email_verified_at' => now()->subDay()]);
    $expected = $user->fresh()->email_verified_at->toIso8601String();
    expect(app(AuthService::class)->profile($user)['email_verified_at'])->toBe($expected);
});