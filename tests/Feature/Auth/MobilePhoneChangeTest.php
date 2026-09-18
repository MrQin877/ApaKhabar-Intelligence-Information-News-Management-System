<?php

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
    $this->travelTo(now()->startOfDay()->addHours(12));
    config(['services.bulk360.app_key' => 'test-key', 'services.bulk360.app_secret' => 'test-secret']);
    $this->providerCode = 200;
    $this->code = null;
    Http::preventStrayRequests();
    Http::fake(function ($request) {
        preg_match('/\b([0-9]{6})\b/', $request['text'], $matches);
        $this->code = $matches[1];
        return Http::response(['code' => $this->providerCode]);
    });
    $this->user = User::factory()->create();
    $this->user->phoneRecord()->create(['phone' => '+60123456789', 'phone_verified_at' => now()->subDay()]);
    $this->before = $this->user->fresh()->phoneRecord->getRawOriginal();
    $this->headers = ['Authorization' => 'Bearer '.$this->user->createToken('test')->plainTextToken];
});

test('phone change sends automatically without password and keeps the old phone until verified', function () {
    $response = $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $this->headers)
        ->assertOk()->assertJsonPath('status', 'otp-sent')->assertJsonPath('retry_after', 60);
    $challenge = $response->json('challenge');
    expect($this->user->fresh()->phoneRecord->getRawOriginal())->toBe($this->before);
    $this->getJson('/api/profile', $this->headers)->assertJsonPath('phone', '+60123456789');
    $this->getJson('/api/phone/change-verification?challenge='.$challenge, $this->headers)
        ->assertOk()->assertJsonPath('phone', '+628123456789')->assertJsonPath('otp_pending', true)->assertJsonMissingPath('otp_hash');
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $challenge, 'otp' => $this->code], $this->headers)
        ->assertOk()->assertJsonPath('status', 'phone-verified');
    $fresh = $this->user->fresh();
    expect($fresh->phone)->toBe('+628123456789');
    expect($fresh->phone_verified_at)->not->toBeNull();
    expect($fresh->email_verified_at->toIso8601String())->toBe($this->user->email_verified_at->toIso8601String());
    $this->assertDatabaseMissing('phones', ['phone' => '+60123456789']);
    $this->getJson('/api/profile', $this->headers)->assertJsonPath('phone', '+628123456789');
    Http::assertSentCount(1);
});

test('abandoned expired or incorrect challenges keep the verified phone unchanged', function () {
    $challenge = $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $this->headers)->json('challenge');
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $challenge, 'otp' => '000000'], $this->headers)->assertUnprocessable();
    expect($this->user->fresh()->phoneRecord->getRawOriginal())->toBe($this->before);
    $this->travel(11)->minutes();
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $challenge, 'otp' => $this->code], $this->headers)->assertUnprocessable();
    expect($this->user->fresh()->phoneRecord->getRawOriginal())->toBe($this->before);
});

test('pending changes share the cooldown and five request daily limit', function () {
    $challenge = $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $this->headers)->json('challenge');
    $this->postJson('/api/phone/change-verification', ['challenge' => $challenge], $this->headers)->assertStatus(429)->assertHeader('Retry-After', '60');
    for ($i = 0; $i < 4; $i++) {
        $this->travel(60)->seconds();
        $this->postJson('/api/phone/change-verification', ['challenge' => $challenge], $this->headers)->assertOk();
    }
    $this->travel(60)->seconds();
    $this->postJson('/api/phone/change-verification', ['phone' => '+628987654321'], $this->headers)->assertStatus(429)->assertJsonPath('daily_limit_reached', true);
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $challenge, 'otp' => $this->code], $this->headers)->assertOk();
    Http::assertSentCount(5);
});

test('provider failure leaves the saved phone unchanged', function () {
    $this->providerCode = 402;
    $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $this->headers)->assertStatus(503);
    expect($this->user->fresh()->phoneRecord->getRawOriginal())->toBe($this->before);
});

test('another account cannot use the pending challenge', function () {
    $challenge = $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $this->headers)->json('challenge');
    $other = User::factory()->create();
    $headers = ['Authorization' => 'Bearer '.$other->createToken('other')->plainTextToken];
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $challenge, 'otp' => $this->code], $headers)->assertStatus(410);
    expect($this->user->fresh()->phoneRecord->getRawOriginal())->toBe($this->before);
});

test('number claimed before verification cannot replace the current number', function () {
    $challenge = $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $this->headers)->json('challenge');
    User::factory()->create()->phoneRecord()->create(['phone' => '+628123456789', 'phone_verified_at' => now()]);
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $challenge, 'otp' => $this->code], $this->headers)->assertStatus(409);
    expect($this->user->fresh()->phoneRecord->getRawOriginal())->toBe($this->before);
});

test('phone change requires authentication and rejects an already registered number', function () {
    $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'])->assertUnauthorized();
    User::factory()->create()->phoneRecord()->create(['phone' => '+628123456789', 'phone_verified_at' => now()]);
    $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $this->headers)->assertUnprocessable();
    Http::assertNothingSent();
});

test('an unverified number becomes used only when the new owner successfully verifies it', function () {
    $other = User::factory()->create();
    $other->phoneRecord()->create(['phone' => '+628123456789', 'phone_otp' => '123456']);
    $challenge = $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $this->headers)
        ->assertOk()->json('challenge');
    expect($other->fresh()->phone)->toBe('+628123456789');
    expect($this->user->fresh()->phoneRecord->getRawOriginal())->toBe($this->before);
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $challenge, 'otp' => '000000'], $this->headers)->assertUnprocessable();
    expect($other->fresh()->phone)->toBe('+628123456789');
    expect($this->user->fresh()->phoneRecord->getRawOriginal())->toBe($this->before);
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $challenge, 'otp' => $this->code], $this->headers)->assertOk();
    expect($other->fresh()->phone)->toBeNull();
    expect($this->user->fresh()->phone)->toBe('+628123456789');
    expect($this->user->fresh()->phone_verified_at)->not->toBeNull();
});

test('expired OTP can be resent and retried in the same verification session', function () {
    $challenge = $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $this->headers)->json('challenge');
    $this->travel(11)->minutes();
    $this->getJson('/api/phone/change-verification?challenge='.$challenge, $this->headers)->assertOk()->assertJsonPath('otp_pending', false);
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $challenge, 'otp' => $this->code], $this->headers)->assertUnprocessable();
    expect($this->user->fresh()->phoneRecord->getRawOriginal())->toBe($this->before);
    $this->postJson('/api/phone/change-verification', ['challenge' => $challenge], $this->headers)->assertOk()->assertJsonPath('challenge', $challenge);
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $challenge, 'otp' => $this->code], $this->headers)->assertOk();
});

test('an OTP request does not reserve a number against another pending account', function () {
    $firstChallenge = $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $this->headers)->json('challenge');
    $firstOtp = $this->code;
    $this->assertDatabaseMissing('phones', ['phone' => '+628123456789']);
    $other = User::factory()->create();
    $other->phoneRecord()->create(['phone' => '+60198765432', 'phone_verified_at' => now()]);
    $headers = ['Authorization' => 'Bearer '.$other->createToken('test')->plainTextToken];
    $this->travel(60)->seconds();
    $secondChallenge = $this->postJson('/api/phone/change-verification', ['phone' => '+628123456789'], $headers)->assertOk()->json('challenge');
    $this->assertDatabaseMissing('phones', ['phone' => '+628123456789']);
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $firstChallenge, 'otp' => $firstOtp], $this->headers)->assertOk();
    $this->postJson('/api/phone/change-verification/verify', ['challenge' => $secondChallenge, 'otp' => $this->code], $headers)->assertStatus(409);
    expect($other->fresh()->phone)->toBe('+60198765432');
});
