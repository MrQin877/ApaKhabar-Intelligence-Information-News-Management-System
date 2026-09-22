<?php

use App\Models\User;
use App\Services\Settings\PhoneOtpRateLimiter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Cache::flush();
    Notification::fake();
    Http::preventStrayRequests();
    $this->providerCode = 200;
    Http::fake(fn () => Http::response(['code' => $this->providerCode]));
    config(['services.bulk360.app_key' => 'test-key', 'services.bulk360.app_secret' => 'test-secret']);
    $this->travelTo(now()->startOfDay()->addHours(12));
    $this->user = User::factory()->create();
    $this->user->phoneRecord()->create(['phone' => '+60123456789']);
    $this->headers = ['Authorization' => 'Bearer '.$this->user->createToken('mobile')->plainTextToken];
});

test('mobile phone endpoints require a bearer token', function () {
    $this->getJson('/api/phone/verification-status')->assertUnauthorized();
    $this->postJson('/api/phone/verification-notification')->assertUnauthorized();
    $this->postJson('/api/phone/verify')->assertUnauthorized();
    Http::assertNothingSent();
});

test('mobile requests send only to the saved number and verification refreshes profile without changing email', function () {
    $emailTimestamp = $this->user->email_verified_at->toIso8601String();
    $this->postJson('/api/phone/verification-notification', ['phone' => '+628123456789'], $this->headers)
        ->assertOk()->assertJsonPath('status', 'otp-sent')->assertJsonPath('retry_after', 60)
        ->assertJsonPath('phone', '+60123456789')->assertJsonPath('otp_pending', true)
        ->assertJsonMissingPath('phone_otp');
    $otp = $this->user->fresh()->phone_otp;
    Http::assertSent(fn ($request) => $request['to'] === '60123456789' && str_contains($request['text'], $otp));
    $this->getJson('/api/phone/verification-status', $this->headers)->assertOk()
        ->assertJsonPath('retry_after', 60)->assertJsonMissingPath('phone_otp');
    $this->postJson('/api/phone/verify', ['phone' => '+60123456789', 'otp' => $otp], $this->headers)
        ->assertOk()->assertJsonPath('status', 'phone-verified')->assertJsonPath('otp_pending', false);
    $fresh = $this->user->fresh();
    expect($fresh->phone_otp)->toBeNull();
    expect($fresh->phone_otp_expires_at)->toBeNull();
    $this->getJson('/api/profile', $this->headers)->assertOk()
        ->assertJsonPath('phone_verified_at', $fresh->phone_verified_at->toIso8601String())
        ->assertJsonPath('email_verified_at', $emailTimestamp);
    $this->postJson('/api/phone/verification-notification', [], $this->headers)
        ->assertOk()->assertJsonPath('status', 'already-verified');
    $this->postJson('/api/phone/verify', ['phone' => '+60123456789', 'otp' => $otp], $this->headers)
        ->assertOk()->assertJsonPath('status', 'already-verified');
    expect($this->user->fresh()->phone_verified_at->toIso8601String())->toBe($fresh->phone_verified_at->toIso8601String());
    Http::assertSentCount(1);
});

test('mobile cooldown survives reload and allows the next send at sixty seconds', function () {
    $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertOk();
    $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertStatus(429)->assertHeader('Retry-After', '60');
    $this->travel(59)->seconds();
    $this->getJson('/api/phone/verification-status', $this->headers)->assertJsonPath('retry_after', 1);
    $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertStatus(429);
    $this->travel(1)->seconds();
    $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertOk();
    Http::assertSentCount(2);
});

test('mobile daily limit allows five requests and verification but blocks a sixth until tomorrow', function () {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertOk();
        $this->travel(60)->seconds();
    }
    $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertStatus(429)
        ->assertJsonPath('daily_limit_reached', true)->assertJsonPath('message', PhoneOtpRateLimiter::DAILY_MESSAGE);
    $this->postJson('/api/phone/verify', ['phone' => '+60123456789', 'otp' => $this->user->fresh()->phone_otp], $this->headers)->assertOk();
    Http::assertSentCount(5);
    $this->travelTo(now()->startOfDay()->addDay());
    $this->getJson('/api/phone/verification-status', $this->headers)->assertOk()->assertJsonPath('daily_limit_reached', false);
});

test('web and mobile share request limits', function () {
    $this->actingAs($this->user)->post(route('phone.resend'))->assertSessionHas('status', 'otp-sent');
    $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertStatus(429);
    $this->travel(60)->seconds();
    $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertOk();
    $this->actingAs($this->user->fresh())->post(route('phone.resend'))->assertSessionHasErrors('phone');
    Http::assertSentCount(1);
});

test('missing expired malformed wrong and changed-number codes cannot verify a phone', function (string $kind) {
    $this->user->phoneRecord()->update(['phone_otp' => '123456', 'phone_otp_expires_at' => now()->addMinutes(10)]);
    $payload = ['phone' => '+60123456789', 'otp' => '123456'];
    if ($kind === 'missing') $this->user->phoneRecord()->update(['phone_otp' => null, 'phone_otp_expires_at' => null]);
    if ($kind === 'expired') $this->user->phoneRecord()->update(['phone_otp_expires_at' => now()]);
    if ($kind === 'wrong') $payload['otp'] = '654321';
    if ($kind === 'malformed') $payload['otp'] = 'abc123';
    if ($kind === 'changed') $payload['phone'] = '+628123456789';
    $this->postJson('/api/phone/verify', $payload, $this->headers)->assertStatus($kind === 'changed' ? 409 : 422);
    expect($this->user->fresh()->phone_verified_at)->toBeNull();
})->with(['missing', 'expired', 'wrong', 'malformed', 'changed']);

test('mobile verification limits incorrect guesses', function () {
    $this->user->phoneRecord()->update(['phone_otp' => '123456', 'phone_otp_expires_at' => now()->addMinutes(10)]);
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/phone/verify', ['phone' => '+60123456789', 'otp' => '654321'], $this->headers)->assertUnprocessable();
    }
    $this->postJson('/api/phone/verify', ['phone' => '+60123456789', 'otp' => '123456'], $this->headers)->assertStatus(429);
    expect($this->user->fresh()->phone_verified_at)->toBeNull();
});

test('mobile provider rejection clears the code and still consumes request allowance', function () {
    $this->providerCode = 402;
    $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertStatus(503)
        ->assertJsonPath('otp_pending', false)->assertJsonPath('retry_after', 60);
    expect($this->user->fresh()->phone_otp)->toBeNull();
    $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertStatus(429);
    Http::assertSentCount(1);
});

test('mobile requests without a saved phone do not send SMS or consume the allowance', function () {
    $this->user->phoneRecord()->delete();
    $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertUnprocessable();
    $this->getJson('/api/phone/verification-status', $this->headers)->assertJsonPath('phone', null)->assertJsonPath('retry_after', 0);
    Http::assertNothingSent();
});

test('phone-only mobile registration can request and verify OTP', function () {
    $registration = $this->postJson('/api/register', [
        'name' => 'Phone Registrant', 'phone' => '+628123456789', 'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ])->assertCreated()->assertJsonPath('user.email', null)->assertJsonPath('user.phone_verified_at', null);
    $headers = ['Authorization' => 'Bearer '.$registration->json('token')];
    $this->postJson('/api/phone/verification-notification', [], $headers)->assertOk();
    $user = User::findOrFail($registration->json('user.id'));
    $this->postJson('/api/phone/verify', ['phone' => $user->phone, 'otp' => $user->phone_otp], $headers)
        ->assertOk()->assertJsonPath('status', 'phone-verified');
    $this->getJson('/api/profile', $headers)->assertOk()->assertJsonPath('email_verified_at', null)
        ->assertJson(fn ($json) => $json->where('phone_verified_at', fn ($value) => is_string($value))->etc());
});

test('a replaced OTP and a different account cannot verify the saved phone', function () {
    $this->user->phoneRecord()->update(['phone_otp' => '000000', 'phone_otp_expires_at' => now()->addMinutes(10)]);
    $this->postJson('/api/phone/verification-notification', [], $this->headers)->assertOk();
    $this->postJson('/api/phone/verify', ['phone' => '+60123456789', 'otp' => '000000'], $this->headers)->assertUnprocessable();
    $other = User::factory()->create();
    $other->phoneRecord()->create(['phone' => '+628123456789']);
    $this->postJson('/api/phone/verify', ['phone' => '+60123456789', 'otp' => $this->user->fresh()->phone_otp], [
        'Authorization' => 'Bearer '.$other->createToken('other')->plainTextToken,
    ])->assertStatus(409);
    expect($this->user->fresh()->phone_verified_at)->toBeNull();
    expect($other->fresh()->phone_verified_at)->toBeNull();
});
