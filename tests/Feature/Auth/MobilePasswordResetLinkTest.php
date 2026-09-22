<?php

use App\Models\User;
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
    'Expo Go' => 'exp://192.168.68.63:8081/--/reset-password',
    'mobile website' => 'http://192.168.68.50:8081/reset-password',
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

test('mobile password email leads through the browser redirect and its token resets the password once', function () {
    Notification::fake();
    config(['services.mobile.password_reset_return_url' => 'exp://192.168.68.50:8081/--/reset-password']);
    $user = User::factory()->create();
    $user->emailRecord()->update(['email' => 'person+mobile@example.com']);
    $user->refresh();
    $previousCallback = ResetPassword::$createUrlCallback;

    try {
        $this->postJson('http://192.168.68.50:8000/api/forgot-password', ['email' => $user->email])->assertOk();
        $notification = Notification::sent($user, ResetPassword::class)->sole();
        $url = $notification->toMail($user)->actionUrl;
        expect(parse_url($url, PHP_URL_HOST))->toBe('192.168.68.50');
        expect(parse_url($url, PHP_URL_PORT))->toBe(8000);
        expect(parse_url($url, PHP_URL_PATH))->toBe('/mobile/reset-password');
        parse_str(parse_url($url, PHP_URL_QUERY), $parameters);
        expect($parameters['email'])->toBe($user->email);
        $this->get($url)->assertRedirect('exp://192.168.68.50:8081/--/reset-password?'.http_build_query($parameters, '', '&', PHP_QUERY_RFC3986));

        $payload = [...$parameters, 'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!'];
        $this->postJson('/api/reset-password', $payload)->assertOk();
        expect(Hash::check('NewPassword123!', $user->fresh()->password))->toBeTrue();
        $this->postJson('/api/reset-password', $payload)->assertUnprocessable();
    } finally {
        ResetPassword::$createUrlCallback = $previousCallback;
    }
});
