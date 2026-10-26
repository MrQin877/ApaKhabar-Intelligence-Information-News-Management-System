<?php

use App\Models\User;
use App\Models\UserRole;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    config(['session.driver' => 'cookie', 'session.secure' => true]);
    Route::middleware('web')->get('/remember-test', fn () => response()->json(['id' => Auth::id()]));
});

function freshRememberRequest($test, array $cookies = []): void
{
    Auth::forgetGuards();
    app('session')->forgetDrivers();
    app()->forgetInstance('session.store');
    app('cookie')->flushQueuedCookies();
    $test->withUnencryptedCookies($cookies);
}

test('remember cookie survives loss of session cookies for every role', function (string $role) {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => $role])->getKey()]);
    $response = $this->post('/login', ['email' => $user->email, 'password' => 'password', 'remember' => '1']);
    $this->assertAuthenticatedAs($user);
    $session = $response->getCookie(config('session.cookie'), false);
    expect($session->getExpiresTime())->toBe(0)->and($session->isHttpOnly())->toBeTrue()->and($session->isSecure())->toBeTrue()->and($session->getSameSite())->toBe('lax');
    $name = Auth::guard()->getRecallerName();
    $remember = $response->getCookie($name, false);
    expect($remember->getExpiresTime())->toBeGreaterThan(time())->and($remember->isHttpOnly())->toBeTrue()->and($remember->isSecure())->toBeTrue()->and($remember->getSameSite())->toBe('lax');
    freshRememberRequest($this, [$name => $remember->getValue()]);
    $this->get('/remember-test')->assertJsonPath('id', $user->getKey());
    expect(Auth::guard()->viaRemember())->toBeTrue();
})->with(['admin', 'moderator', 'villager']);

test('unchecked login survives refresh but ends without browser session cookies', function () {
    $user = User::factory()->create();
    $response = $this->post('/login', ['email' => $user->email, 'password' => 'password']);
    $response->assertCookieMissing(Auth::guard()->getRecallerName());
    $cookies = [];
    foreach ($response->headers->getCookies() as $cookie) {
        if ($cookie->getName() !== 'XSRF-TOKEN' && ($cookie->getExpiresTime() === 0 || $cookie->getExpiresTime() > time())) {
            expect($cookie->getExpiresTime())->toBe(0);
            $cookies[$cookie->getName()] = $cookie->getValue();
        }
    }
    freshRememberRequest($this, $cookies);
    $this->get('/remember-test')->assertJsonPath('id', $user->getKey());
    // Drop browser cookies while retaining the server-side database/user.
    foreach ($cookies as $name => $value) {
        $cookies[$name] = '';
    }
    freshRememberRequest($this, $cookies);
    $this->get('/remember-test')->assertJsonPath('id', null);
});

test('logout clears remembered authentication and rejects the old remember cookie', function () {
    $user = User::factory()->create();
    $response = $this->post('/login', ['email' => $user->email, 'password' => 'password', 'remember' => '1']);
    $name = Auth::guard()->getRecallerName();
    $remember = $response->getCookie($name, false)->getValue();
    $oldToken = $user->fresh()->getRememberToken();
    $cookies = [];
    foreach ($response->headers->getCookies() as $cookie) {
        $cookies[$cookie->getName()] = $cookie->getValue();
    }
    freshRememberRequest($this, $cookies);
    $logout = $this->post('/logout');
    $logout->assertCookieExpired($name);
    $this->assertGuest();
    expect($user->fresh()->getRememberToken())->not->toBe($oldToken);
    freshRememberRequest($this, array_merge(array_fill_keys(array_keys($cookies), ''), [$name => $remember]));
    $this->get('/remember-test')->assertJsonPath('id', null);
});

test('ordinary sessions expire at the configured idle lifetime', function () {
    config(['session.lifetime' => 2]);
    $user = User::factory()->create();
    $response = $this->post('/login', ['email' => $user->email, 'password' => 'password', 'remember' => '0']);
    $cookies = [];
    foreach ($response->headers->getCookies() as $cookie) {
        $cookies[$cookie->getName()] = $cookie->getValue();
    }
    $this->travel(3)->minutes();
    freshRememberRequest($this, $cookies);
    $this->get('/remember-test')->assertJsonPath('id', null);
});
