<?php

use App\Models\User;
use App\Notifications\MobileResetPassword;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

test('mobile reset link uses the configured destination and preserves encoded parameters', function (string $destination) {
    config(['services.mobile.password_reset_return_url' => $destination]);
    $parameters = ['token' => 'test-reset-token', 'email' => 'person+mobile@example.com'];
    $query = http_build_query($parameters, '', '&', PHP_QUERY_RFC3986);
    $separator = str_contains($destination, '?') ? '&' : '?';

    $this->get('/mobile/reset-password?'.$query.'&redirect=https://untrusted.example')
        ->assertRedirect($destination.$separator.$query)
        ->assertHeader('Referrer-Policy', 'no-referrer')
        ->assertHeader('Cache-Control', 'no-store, private');
})->with([
    'Expo Go' => 'exp://expo.example.test:8081/--/reset-password',
    'mobile website' => 'http://backend.example.test:8081/reset-password',
    'installed app' => 'apakhabarmobileapp:///reset-password',
    'existing query' => 'https://mobile.example/reset-password?source=email',
]);

test('mobile reset redirect rejects incomplete or malformed parameters', function (array $parameters) {
    $this->getJson('/mobile/reset-password?'.http_build_query($parameters))
        ->assertUnprocessable();
})->with([
    'missing token' => [['email' => 'person@example.com']],
    'missing email' => [['token' => 'test-token']],
    'invalid email' => [['token' => 'test-token', 'email' => 'invalid']],
    'array token' => [['token' => ['test-token'], 'email' => 'person@example.com']],
]);

test('mobile reset email uses current session and Docker origin then resets password and logs in', function (int $metroPort) {
    Notification::fake();
    config(['app.url' => 'http://current-laptop.example.test:8088']);
    $returnUrl = 'exp://current-laptop.example.test:'.$metroPort.'/--/reset-password';
    $user = User::factory()->create();
    $user->emailRecord()->update(['email' => 'person+mobile@example.com']);
    $user->refresh();
    $previousCallback = ResetPassword::$createUrlCallback;
    $this->postJson('/api/forgot-password', ['email' => $user->email, 'return_url' => $returnUrl])->assertOk();
    $notification = Notification::sent($user, MobileResetPassword::class)->sole();
    $url = $notification->toMail($user)->actionUrl;
    expect(parse_url($url, PHP_URL_HOST))->toBe('current-laptop.example.test')
        ->and(parse_url($url, PHP_URL_PORT))->toBe(8088)
        ->and(ResetPassword::$createUrlCallback)->toBe($previousCallback);
    parse_str(parse_url($url, PHP_URL_QUERY), $parameters);
    expect($parameters['email'])->toBe($user->email)->and($parameters['return_url'])->toBe($returnUrl);
    $query = http_build_query(['token' => $parameters['token'], 'email' => $user->email], '', '&', PHP_QUERY_RFC3986);
    $this->get($url)->assertRedirect($returnUrl.'?'.$query)
        ->assertHeader('Referrer-Policy', 'no-referrer')->assertHeader('Cache-Control', 'no-store, private');
    $payload = ['token' => $parameters['token'], 'email' => $user->email, 'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!'];
    $this->postJson('/api/reset-password', $payload)->assertOk();
    expect(Hash::check('NewPassword123!', $user->fresh()->password))->toBeTrue();
    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])->assertUnauthorized();
    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'NewPassword123!'])->assertOk()->assertJsonStructure(['token']);
    $this->postJson('/api/reset-password', $payload)->assertUnprocessable()->assertJsonPath('code', 'invalid_or_expired_reset_token');

    // A website request in the same process still generates its normal Fortify URL.
    $websiteUser = User::factory()->create();
    $this->post('/forgot-password', ['email' => $websiteUser->email])->assertSessionHasNoErrors();
    $websiteNotification = Notification::sent($websiteUser, ResetPassword::class)->sole();
    expect(parse_url($websiteNotification->toMail($websiteUser)->actionUrl, PHP_URL_PATH))->toStartWith('/reset-password/');
})->with([8081, 8082]);

test('unsafe mobile return destinations are rejected before any email is sent', function (string $destination) {
    Notification::fake();
    config(['app.url' => 'http://current-laptop.example.test:8088']);
    $user = User::factory()->create();
    $this->postJson('/api/forgot-password', ['email' => $user->email, 'return_url' => $destination])
        ->assertUnprocessable()->assertJsonValidationErrors('return_url');
    Notification::assertNothingSent();
})->with([
    'exp://old-laptop.example.test:8081/--/reset-password',
    'https://untrusted.example/reset-password',
    'exp://user@current-laptop.example.test:8081/--/reset-password',
    'exp://current-laptop.example.test:8081/--/reset-password?email=other@example.com',
    'exp://current-laptop.example.test:8081/--/reset-password#fragment',
    'javascript:alert(1)', 'apakhabarmobileapp://other-screen',
]);

test('signed mobile handoff rejects tampering unsigned overrides and expired emails', function () {
    Notification::fake();
    config(['app.url' => 'http://current-laptop.example.test:8088']);
    $user = User::factory()->create();
    $this->postJson('/api/forgot-password', ['email' => $user->email, 'return_url' => 'exp://current-laptop.example.test:8081/--/reset-password'])->assertOk();
    $url = Notification::sent($user, MobileResetPassword::class)->sole()->toMail($user)->actionUrl;
    $this->getJson($url.'&extra=tampered')->assertForbidden();
    $this->getJson('/mobile/reset-password?'.http_build_query(['token' => 'test-token', 'email' => $user->email, 'return_url' => 'https://untrusted.example/reset-password']))->assertForbidden();
    $this->travel(61)->minutes();
    $this->getJson($url)->assertForbidden();
    parse_str(parse_url($url, PHP_URL_QUERY), $parameters);
    $this->postJson('/api/reset-password', ['token' => $parameters['token'], 'email' => $user->email, 'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!'])
        ->assertUnprocessable()->assertJsonPath('code', 'invalid_or_expired_reset_token');
});

test('Azure HTTPS origin and registered installed app scheme work without a LAN override', function () {
    Notification::fake();
    app()->instance('env', 'production');
    config(['app.url' => 'https://backend.example.azurewebsites.net']);
    $user = User::factory()->create();
    $this->postJson('/api/forgot-password', ['email' => $user->email, 'return_url' => 'apakhabarmobileapp:///reset-password'])->assertOk();
    $url = Notification::sent($user, MobileResetPassword::class)->sole()->toMail($user)->actionUrl;
    expect(str_starts_with($url, 'https://backend.example.azurewebsites.net/mobile/reset-password?'))->toBeTrue();
    parse_str(parse_url($url, PHP_URL_QUERY), $parameters);
    $this->get($url)->assertRedirect('apakhabarmobileapp:///reset-password?'.http_build_query(['token' => $parameters['token'], 'email' => $user->email], '', '&', PHP_QUERY_RFC3986));
    $this->postJson('/api/forgot-password', ['email' => $user->email, 'return_url' => 'exp://backend.example.azurewebsites.net:8081/--/reset-password'])->assertUnprocessable();
});
