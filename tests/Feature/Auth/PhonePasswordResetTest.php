<?php

use App\Models\User;
use App\Services\Settings\PhoneOtpRateLimiter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
    $this->travelTo(now()->startOfDay()->addHours(12));
    config(['services.bulk360.app_key' => 'test-key', 'services.bulk360.app_secret' => 'test-secret']);
    $this->providerCode = 200;
    Http::preventStrayRequests();
    Http::fake(function ($request) {
        preg_match('/\b([0-9]{6})\b/', $request['text'], $matches);
        $this->otp = $matches[1];
        return Http::response(['code' => $this->providerCode]);
    });
    $this->user = User::factory()->create();
    $this->user->phoneRecord()->create(['phone' => '+60123456789', 'phone_verified_at' => now()->subDay()]);
});

function beginPhoneReset($test): string
{
    return $test->postJson('/api/phone/password/send', ['phone' => $test->user->phone])
        ->assertOk()->assertJsonPath('retry_after', 60)->assertJsonPath('status', 'otp-sent')->json('challenge');
}

function authorizePhoneReset($test, string $challenge): string
{
    return $test->postJson('/api/phone/password/verify', ['challenge' => $challenge, 'otp' => $test->otp])
        ->assertOk()->assertJsonPath('status', 'reset-authorized')->assertHeader('Cache-Control', 'no-store, private')->json('reset_token');
}

function phoneResetPayload(string $challenge, string $token): array
{
    return ['challenge' => $challenge, 'token' => $token, 'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!'];
}

test('verified phone recovery resets only the password and works without email', function (string $phone, bool $hasEmail) {
    $this->user->phoneRecord->update(['phone' => $phone]);
    if (!$hasEmail) $this->user->emailRecord()->delete();
    $this->user->refresh();
    $emailBefore = $this->user->emailRecord?->getRawOriginal();
    $phoneBefore = $this->user->phoneRecord->getRawOriginal();
    $challenge = beginPhoneReset($this);
    expect(Hash::check('password', $this->user->fresh()->password))->toBeTrue();
    $this->getJson('/api/phone/password/status?challenge='.$challenge)->assertOk()->assertJsonMissingPath('otp_hash')->assertJsonMissingPath('password_fingerprint');
    $token = authorizePhoneReset($this, $challenge);
    $payload = phoneResetPayload($challenge, $token);
    $this->postJson('/api/phone/password/reset', $payload)->assertOk();
    expect(Hash::check('NewPassword123!', $this->user->fresh()->password))->toBeTrue();
    expect($this->user->fresh()->phoneRecord->getRawOriginal())->toBe($phoneBefore);
    expect($this->user->fresh()->emailRecord?->getRawOriginal())->toBe($emailBefore);
    $this->postJson('/api/phone/password/reset', $payload)->assertStatus(410);
    $login = $this->postJson('/api/login', ['phone' => $phone, 'password' => 'NewPassword123!'])->assertOk();
    $this->getJson('/api/profile', ['Authorization' => 'Bearer '.$login->json('token')])->assertOk()
        ->assertJsonPath('phone', $phone)->assertJsonPath('email_verified_at', $this->user->fresh()->email_verified_at?->toIso8601String());
    Http::assertSentCount(1);
})->with(['+60123456789', '+628123456789'])->with([true, false]);

test('unknown and unverified numbers cannot recover accounts or reserve ownership', function () {
    $this->postJson('/api/phone/password/send', ['phone' => '+628123456789'])->assertUnprocessable();
    $this->user->phoneRecord->update(['phone_verified_at' => null]);
    $this->postJson('/api/phone/password/send', ['phone' => $this->user->phone])->assertUnprocessable();
    Http::assertNothingSent();
    expect($this->user->fresh()->phone_verified_at)->toBeNull();
});

test('OTP alone or a forged token cannot reset the password', function () {
    $challenge = beginPhoneReset($this);
    $this->postJson('/api/phone/password/reset', phoneResetPayload($challenge, str_repeat('a', 64)))->assertUnprocessable();
    $this->postJson('/api/phone/password/verify', ['challenge' => $challenge, 'otp' => '000000'])->assertUnprocessable();
    expect(Hash::check('password', $this->user->fresh()->password))->toBeTrue();
    $token = authorizePhoneReset($this, $challenge);
    $this->postJson('/api/phone/password/verify', ['challenge' => $challenge, 'otp' => $this->otp])->assertUnprocessable();
    $invalid = phoneResetPayload($challenge, $token);
    $invalid['password_confirmation'] = 'different';
    $this->postJson('/api/phone/password/reset', $invalid)->assertUnprocessable();
    $this->postJson('/api/phone/password/reset', phoneResetPayload($challenge, $token))->assertOk();
});

test('five wrong codes block verification until a fresh OTP is requested', function () {
    $challenge = beginPhoneReset($this);
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/phone/password/verify', ['challenge' => $challenge, 'otp' => '000000'])->assertUnprocessable();
    }
    $this->postJson('/api/phone/password/verify', ['challenge' => $challenge, 'otp' => $this->otp])->assertStatus(429);
    $this->travel(60)->seconds();
    $this->postJson('/api/phone/password/send', ['challenge' => $challenge])->assertOk();
    authorizePhoneReset($this, $challenge);
});

test('resend shares cooldown and daily limits with existing verification', function () {
    $challenge = beginPhoneReset($this);
    $this->postJson('/api/phone/password/send', ['challenge' => $challenge])->assertStatus(429)->assertHeader('Retry-After', '60');
    expect(app(PhoneOtpRateLimiter::class)->status($this->user, $this->user->phone)['retryAt'])->toBe(now()->timestamp + 60);
    for ($i = 0; $i < 4; $i++) {
        $this->travel(60)->seconds();
        $this->postJson('/api/phone/password/send', ['challenge' => $challenge])->assertOk();
    }
    $this->travel(60)->seconds();
    $this->postJson('/api/phone/password/send', ['phone' => $this->user->phone])->assertStatus(429)->assertJsonPath('daily_limit_reached', true);
    authorizePhoneReset($this, $challenge);
    Http::assertSentCount(5);
    $this->travel(1)->days();
    $this->postJson('/api/phone/password/send', ['phone' => $this->user->phone])->assertOk();
});

test('expired OTP can be resent but expired reset tokens cannot be used', function () {
    $challenge = beginPhoneReset($this);
    $this->travel(11)->minutes();
    $this->postJson('/api/phone/password/verify', ['challenge' => $challenge, 'otp' => $this->otp])->assertUnprocessable();
    $this->postJson('/api/phone/password/send', ['challenge' => $challenge])->assertOk();
    $token = authorizePhoneReset($this, $challenge);
    $this->travel(11)->minutes();
    $this->postJson('/api/phone/password/reset', phoneResetPayload($challenge, $token))->assertUnprocessable();
});

test('resending invalidates previous OTP and password-reset authorization', function () {
    $challenge = beginPhoneReset($this);
    $token = authorizePhoneReset($this, $challenge);
    $this->travel(60)->seconds();
    $this->postJson('/api/phone/password/send', ['challenge' => $challenge])->assertOk();
    $this->postJson('/api/phone/password/reset', phoneResetPayload($challenge, $token))->assertUnprocessable();
    $this->travel(60)->seconds();
    $newChallenge = beginPhoneReset($this);
    $this->postJson('/api/phone/password/verify', ['challenge' => $challenge, 'otp' => $this->otp])->assertStatus(410);
    authorizePhoneReset($this, $newChallenge);
});

test('phone ownership and password changes invalidate a recovery grant', function (string $change) {
    $challenge = beginPhoneReset($this);
    $token = authorizePhoneReset($this, $challenge);
    if ($change === 'password') $this->user->update(['password' => 'AnotherPassword123!']);
    else $this->user->phoneRecord->update(['phone' => '+628123456789']);
    $this->postJson('/api/phone/password/reset', phoneResetPayload($challenge, $token))->assertStatus(410);
})->with(['phone', 'password']);

test('provider failure preserves password and keeps shared cooldown', function () {
    $this->providerCode = 402;
    $this->postJson('/api/phone/password/send', ['phone' => $this->user->phone])->assertStatus(503)->assertJsonPath('retry_after', 60);
    $this->postJson('/api/phone/password/send', ['phone' => $this->user->phone])->assertStatus(429);
    expect(Hash::check('password', $this->user->fresh()->password))->toBeTrue();
});

test('phone reset does not accept an account verification challenge', function () {
    $headers = ['Authorization' => 'Bearer '.$this->user->createToken('test')->plainTextToken];
    $challenge = $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $headers)->assertOk()->json('challenge');
    $this->postJson('/api/phone/password/verify', ['challenge' => $challenge, 'otp' => $this->otp])->assertStatus(410);
});
