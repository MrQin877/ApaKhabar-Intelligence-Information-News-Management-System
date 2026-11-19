<?php

use App\Models\User;
use App\Notifications\MobileVerifyEmail;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

test('cloud verification returns to the requesting Expo Go session with a signed destination', function () {
    Notification::fake();
    $user = User::factory()->unverified()->create();
    $destination = 'exp://192.168.68.59:8081/--/verify-email';
    $this->postJson('/api/email/verification-notification', ['return_url' => $destination], [
        'Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken,
    ])->assertOk();
    Notification::assertSentTo($user, MobileVerifyEmail::class, function ($notification) use ($user, $destination) {
        $url = $notification->toMail($user)->actionUrl;
        $this->get($url)->assertOk()->assertSee('href="'.$destination.'"', false);
        $this->get(str_replace(rawurlencode($destination), rawurlencode('exp://other:8081/--/verify-email'), $url))
            ->assertForbidden()->assertDontSee('href="exp://other', false);

        return true;
    });
});

test('verification return URLs reject web redirects credentials and unexpected routes', function (string $destination) {
    $user = User::factory()->unverified()->create();
    Notification::fake();
    $this->postJson('/api/email/verification-notification', ['return_url' => $destination], [
        'Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken,
    ])->assertUnprocessable()->assertJsonValidationErrors('return_url');
    Notification::assertNothingSent();
})->with(['https://untrusted.example/verify-email', 'javascript:alert(1)',
    'exp://user:password@host/--/verify-email', 'exp://host/--/reset-password',
    'exp://host/--/verify-email?token=secret']);

test('registration includes the requesting app destination in its first verification email', function () {
    Notification::fake();
    $destination = 'exp://192.168.68.59:8081/--/verify-email';
    $this->postJson('/api/register', [
        'name' => 'Mobile User', 'email' => 'return@example.com', 'password' => 'Password123!',
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni', 'return_url' => $destination,
    ])->assertCreated();
    Notification::assertSentTo(User::whereHas('emailRecord', fn ($query) => $query->where('email', 'return@example.com'))->first(),
        MobileVerifyEmail::class, fn ($notification) => $notification->returnUrl === $destination);
});

test('mobile profile save and resend use the saved email even with a verified phone', function () {
    Notification::fake();
    $user = User::factory()->create();
    $user->phoneRecord()->create(['phone' => '+60123456789', 'phone_verified_at' => now()]);
    $token = $user->createToken('test')->plainTextToken;
    $headers = ['Authorization' => 'Bearer '.$token];

    $this->patchJson('/api/profile', ['name' => $user->name, 'email' => 'new@example.com'], $headers)
        ->assertOk()->assertJsonPath('email', 'new@example.com')->assertJsonPath('email_verified_at', null);
    $this->getJson('/api/profile', $headers)->assertOk()
        ->assertJsonPath('email_verified_at', null)
        ->assertJson(fn ($json) => $json->where('phone_verified_at', fn ($value) => is_string($value))->etc());
    $this->postJson('/api/email/verification-notification', ['email' => 'attacker@example.com'], $headers)
        ->assertOk()->assertJsonPath('email', 'new@example.com')->assertJsonPath('status', 'verification-link-sent');
    Notification::assertSentTo($user, MobileVerifyEmail::class, function ($notification, $channels, $recipient) {
        expect($recipient->routeNotificationFor('mail', $notification))->toBe('new@example.com');
        $url = $notification->toMail($recipient)->actionUrl;
        expect($url)->toContain('/mobile/email/verify/')->not->toContain('Bearer');
        return true;
    });
    $this->postJson('/api/email/verification-notification', [], $headers)->assertStatus(429)->assertHeader('Retry-After');
});

test('mobile signed link verifies without a login and profile refresh returns the result', function () {
    Event::fake([Verified::class]);
    $user = User::factory()->unverified()->create();
    $url = (new MobileVerifyEmail)->toMail($user)->actionUrl;
    $this->get($url)->assertOk()->assertSee('Alamat e-mail telah disahkan')->assertSee('apakhabarmobileapp:///verify-email');
    $this->get($url)->assertOk();
    Event::assertDispatchedTimes(Verified::class, 1);
    $this->getJson('/api/profile', ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken])
        ->assertOk()->assertJson(fn ($json) => $json->where('email_verified_at', fn ($value) => is_string($value))->etc());
});

test('mobile verification rejects expired tampered old-email and wrong-user links', function (string $kind) {
    $user = User::factory()->unverified()->create();
    $url = URL::temporarySignedRoute('mobile.verification.verify',
        $kind === 'expired' ? now()->subMinute() : now()->addHour(),
        ['id' => $kind === 'wrong-user' ? 999999 : $user->getKey(), 'hash' => sha1($user->email)]);
    if ($kind === 'tampered') {
        $url .= '&extra=changed';
    }
    if ($kind === 'old-email') {
        $user->emailRecord()->update(['email' => 'changed@example.com']);
    }
    $this->get($url)->assertForbidden()->assertSee('Tautan tidak valid');
    expect($user->fresh()->email_verified_at)->toBeNull();
})->with(['expired', 'tampered', 'old-email', 'wrong-user']);

test('mobile verification endpoints require authentication', function () {
    $this->getJson('/api/profile')->assertUnauthorized();
    $this->patchJson('/api/profile', [])->assertUnauthorized();
    $this->postJson('/api/email/verification-notification')->assertUnauthorized();
});

test('mobile resend handles missing and already verified emails without sending', function (bool $missing) {
    Notification::fake();
    $user = User::factory()->create();
    if ($missing) {
        $user->emailRecord()->delete();
    }
    $response = $this->postJson('/api/email/verification-notification', [], [
        'Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken,
    ]);
    $response->assertStatus($missing ? 422 : 200);
    Notification::assertNothingSent();
})->with([true, false]);

test('mobile registration sends a browser-compatible verification link and status', function () {
    Notification::fake();
    $this->postJson('/api/register', [
        'name' => 'Mobile User', 'email' => 'mobile@example.com', 'password' => 'Password123!',
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
    ])->assertCreated()->assertJsonPath('user.email_verified_at', null)->assertJsonPath('user.phone_verified_at', null);
    Notification::assertSentTo(User::whereHas('emailRecord', fn ($query) => $query->where('email', 'mobile@example.com'))->first(), MobileVerifyEmail::class);
});

test('mobile profile validates duplicate email and preserves verification for unchanged email', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $headers = ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken];
    $this->patchJson('/api/profile', ['name' => $user->name, 'email' => $other->email], $headers)->assertUnprocessable()->assertJsonValidationErrors('email');
    $this->patchJson('/api/profile', ['name' => 'New Name', 'email' => $user->email], $headers)->assertOk();
    expect($user->fresh()->email_verified_at)->not->toBeNull();
});

test('mobile login includes independent verification timestamps', function () {
    $user = User::factory()->unverified()->create();
    $user->phoneRecord()->create(['phone' => '+60123456789', 'phone_verified_at' => now()]);
    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
        ->assertOk()->assertJsonPath('user.email_verified_at', null)
        ->assertJson(fn ($json) => $json->has('token')->has('user', fn ($json) => $json
            ->where('phone_verified_at', fn ($value) => is_string($value))->etc()));
});
