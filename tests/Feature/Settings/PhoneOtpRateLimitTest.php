<?php

use App\Models\User;
use App\Notifications\OtpNotification;
use App\Services\Settings\PhoneOtpRateLimiter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Cache::flush();
    Notification::fake();
    $this->travelTo(now()->startOfDay()->addHours(12));
});

test('send replacement and resend share a backend cooldown that survives page reloads', function () {
    $user = User::factory()->create();
    $phone = '+60123456789';

    $this->actingAs($user)->from(route('profile.edit'))
        ->post(route('phone.store'), ['phone' => $phone])
        ->assertSessionHas('status', 'otp-sent');

    $otp = $user->fresh()->phone_otp;

    $this->actingAs($user->fresh())->get(route('profile.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('otpRateLimit.retryAt', now()->timestamp + 60)
            ->where('otpRateLimit.dailyLimitReached', false));

    $this->post(route('phone.store'), ['phone' => '+628123456789'])->assertSessionHasErrors('phone');
    $this->post(route('phone.resend'))->assertSessionHasErrors('phone');
    expect($user->fresh()->phone)->toBe($phone);
    expect($user->fresh()->phone_otp)->toBe($otp);
    Notification::assertSentTimes(OtpNotification::class, 1);

    $this->travel(59)->seconds();
    $this->actingAs($user->fresh())->post(route('phone.resend'))->assertSessionHasErrors('phone');
    $this->travel(1)->seconds();
    $this->actingAs($user->fresh())->post(route('phone.resend'))->assertSessionHas('status', 'otp-sent');
    Notification::assertSentTimes(OtpNotification::class, 2);
});

test('five requests exhaust all send flows but verification is still allowed and midnight resets the allowance', function () {
    $user = User::factory()->create();

    for ($attempt = 0; $attempt < 5; $attempt++) {
        $this->actingAs($user->fresh())->from(route('profile.edit'))
            ->post(route('phone.store'), ['phone' => '+6012345678'.$attempt])
            ->assertSessionHas('status', 'otp-sent');
        $this->travel(60)->seconds();
    }

    $this->actingAs($user->fresh())->post(route('phone.store'), ['phone' => '+628123456789'])
        ->assertSessionHasErrors(['phone' => PhoneOtpRateLimiter::DAILY_MESSAGE]);
    $this->post(route('phone.resend'))
        ->assertSessionHasErrors(['phone' => PhoneOtpRateLimiter::DAILY_MESSAGE]);
    Notification::assertSentTimes(OtpNotification::class, 5);

    $this->get(route('profile.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('otpRateLimit.dailyLimitReached', true)
        ->where('otpRateLimit.dailyResetAt', now()->startOfDay()->addDay()->timestamp));

    $this->actingAs($user->fresh())->post(route('phone.verify'), ['otp' => (string) $user->fresh()->phone_otp])
        ->assertSessionHas('status', 'phone-verified');
    expect($user->fresh()->phone_verified_at)->not->toBeNull();

    $this->travelTo(now()->startOfDay()->addDay());
    $this->actingAs($user->fresh())->post(route('phone.store'), ['phone' => '+628123456789'])
        ->assertSessionHas('status', 'otp-sent');
    Notification::assertSentTimes(OtpNotification::class, 6);
});

test('resends count toward the same daily allowance as the initial send', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('phone.store'), ['phone' => '+628123456789']);

    for ($attempt = 0; $attempt < 4; $attempt++) {
        $this->travel(60)->seconds();
        $this->actingAs($user->fresh())->post(route('phone.resend'))->assertSessionHas('status', 'otp-sent');
    }

    $this->travel(60)->seconds();
    $this->actingAs($user->fresh())->post(route('phone.resend'))
        ->assertSessionHasErrors(['phone' => PhoneOtpRateLimiter::DAILY_MESSAGE]);
    Notification::assertSentTimes(OtpNotification::class, 5);
});

test('phone allowance and cooldown cannot be bypassed using another user', function () {
    $first = User::factory()->create();
    $second = User::factory()->create();
    $limiter = app(PhoneOtpRateLimiter::class);
    $phone = '+60123456789';
    $limiter->reserve($first, $phone);

    expect(fn () => $limiter->reserve($second, $phone))->toThrow(ValidationException::class);

    for ($attempt = 0; $attempt < 4; $attempt++) {
        $this->travel(60)->seconds();
        $limiter->reserve($first, $phone);
    }

    $this->travel(60)->seconds();
    expect(fn () => $limiter->reserve($second, $phone))->toThrow(ValidationException::class, PhoneOtpRateLimiter::DAILY_MESSAGE);
    // An unrelated user and number still have their own allowance.
    $limiter->reserve($second, '+628123456789');
    expect($limiter->status($second, '+628123456789')['dailyLimitReached'])->toBeFalse();
});

test('cooldown continues across midnight while the daily counter resets', function () {
    $user = User::factory()->create();
    $limiter = app(PhoneOtpRateLimiter::class);
    $phone = '+60123456789';
    $this->travelTo(now()->endOfDay()->subSeconds(29)->startOfSecond());
    $limiter->reserve($user, $phone);
    $this->travel(30)->seconds();

    expect(fn () => $limiter->reserve($user, $phone))->toThrow(ValidationException::class);
    $this->travel(30)->seconds();
    $limiter->reserve($user, $phone);
    expect($limiter->status($user, $phone)['dailyLimitReached'])->toBeFalse();
});

test('invalid requests do not consume the allowance', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('phone.store'), ['phone' => 'invalid'])->assertSessionHasErrors('phone');
    $this->post(route('phone.resend'))->assertSessionHasErrors('phone');

    expect(app(PhoneOtpRateLimiter::class)->status($user, null)['retryAt'])->toBe(0);
    Notification::assertNothingSent();
});

test('failed delivery attempts still consume cooldown to prevent repeated provider calls', function () {
    $user = User::factory()->create();
    Notification::shouldReceive('send')->once()->andThrow(new RuntimeException('SMS delivery failed'));

    $this->actingAs($user)->post(route('phone.store'), ['phone' => '+60123456789'])
        ->assertSessionHasErrors(['phone' => 'Gagal menghantar OTP. Sila cuba lagi.']);
    $this->actingAs($user->fresh())->post(route('phone.resend'))
        ->assertSessionHasErrors(['phone' => 'Silakan tunggu 60 detik sebelum meminta OTP lagi.']);
});

test('concurrent requests cannot proceed while a user reservation is locked', function () {
    // Lock::block measures elapsed time using now(), so use a running clock here.
    $this->travelBack();
    $user = User::factory()->create();
    $lock = Cache::lock('phone-otp:user:'.$user->getKey().':lock', 30);
    expect($lock->get())->toBeTrue();

    try {
        $this->actingAs($user)->post(route('phone.store'), ['phone' => '+60123456789'])
            ->assertSessionHasErrors(['phone' => 'Permintaan OTP sedang diproses. Silakan coba lagi sebentar.']);
        Notification::assertNothingSent();
        expect($user->fresh()->phone)->toBeNull();
    } finally {
        $lock->release();
    }

    $this->actingAs($user->fresh())->post(route('phone.store'), ['phone' => '+60123456789'])
        ->assertSessionHas('status', 'otp-sent');
    Notification::assertSentTimes(OtpNotification::class, 1);
});
