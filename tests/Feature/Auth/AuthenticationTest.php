<?php

// ================================================================
// ApaKhabar — Module 2: User Authentication
// File: tests/Feature/Auth/AuthenticationTest.php
//
// Module Overview:
//   This module handles all authentication flows in ApaKhabar
//   including web login, logout, API token login via Sanctum,
//   push token management, password confirmation, password reset
//   and two factor authentication challenge.
//
// Merged from:
//   - AuthenticationTest.php         (TC-AUTH-01 to TC-AUTH-06)
//   - PasswordConfirmationTest.php   (TC-AUTH-07 to TC-AUTH-08)
//   - PasswordResetTest.php          (TC-AUTH-09 to TC-AUTH-13)
//   - TwoFactorChallengeTest.php     (TC-AUTH-14 to TC-AUTH-15)
//   - API Auth (new)                 (TC-AUTH-16 to TC-AUTH-26)
//
// Inputs:
//   - email, password (web login)
//   - email, password (API login via /api/login)
//   - Bearer token (API protected routes)
//   - push_token (mobile Expo push token)
//
// Outputs:
//   - Session created, redirected to dashboard (web)
//   - Sanctum token + user JSON (API)
//   - Push token saved or cleared in database
//   - 401/403/422/429 errors for invalid requests
//
// Positive Test Cases : TC-AUTH-01 to TC-AUTH-15
// Negative Test Cases : TC-AUTH-16 to TC-AUTH-26
// ================================================================

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

// ================================================================
// SECTION 1 — WEB LOGIN AND LOGOUT
// Source: AuthenticationTest.php
// ================================================================

// ── TC-AUTH-01 ──────────────────────────────────────────────────
// Input  : GET /login
// Output : Login screen rendered with HTTP 200
test('TC-AUTH-01: login screen can be rendered', function () {
    $response = $this->get(route('login'));

    $response->assertOk();
});

// ── TC-AUTH-02 ──────────────────────────────────────────────────
// Input  : Valid email and password via web login form
// Output : User authenticated and redirected to dashboard
test('TC-AUTH-02: users can authenticate using the login screen', function () {
    $user = User::factory()->create();

    $response = $this->post(route('login.store'), [
        'email'    => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));
});

// ── TC-AUTH-03 ──────────────────────────────────────────────────
// Input  : Authenticated user POST /logout
// Output : Session cleared, user redirected to home as guest
test('TC-AUTH-03: users can logout and session is cleared', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('logout'));

    $this->assertGuest();
    $response->assertRedirect(route('home'));
});

// ── TC-AUTH-04 ──────────────────────────────────────────────────
// Input  : Login attempt after exceeding rate limit threshold
// Output : 429 Too Many Requests response
test('TC-AUTH-04: users are rate limited after too many failed login attempts', function () {
    $user = User::factory()->create();

    RateLimiter::increment(
        md5('login' . implode('|', [$user->email, '127.0.0.1'])),
        amount: 5
    );

    $response = $this->post(route('login.store'), [
        'email'    => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertTooManyRequests();
});

// ── TC-AUTH-05 ──────────────────────────────────────────────────
// Input  : Correct email but wrong password
// Output : User remains guest, not authenticated
test('TC-AUTH-05: users cannot authenticate with invalid password', function () {
    $user = User::factory()->create();

    $this->post(route('login.store'), [
        'email'    => $user->email,
        'password' => 'wrong-password',
    ]);

    $this->assertGuest();
});

// ── TC-AUTH-06 ──────────────────────────────────────────────────
// Input  : Email that does not exist in database
// Output : User remains guest, not authenticated
test('TC-AUTH-06: users cannot authenticate with non-existent email', function () {
    $this->post(route('login.store'), [
        'email'    => 'notexist@gmail.com',
        'password' => 'password',
    ]);

    $this->assertGuest();
});

// ================================================================
// SECTION 2 — PASSWORD CONFIRMATION
// Source: PasswordConfirmationTest.php
// ================================================================

// ── TC-AUTH-07 ──────────────────────────────────────────────────
// Input  : Authenticated user GET /confirm-password
// Output : Password confirmation screen renders HTTP 200
test('TC-AUTH-07: confirm password screen can be rendered for authenticated user', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('password.confirm'));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->component('auth/confirm-password'),
    );
});

// ── TC-AUTH-08 ──────────────────────────────────────────────────
// Input  : Unauthenticated GET /confirm-password
// Output : Redirected to login page
test('TC-AUTH-08: password confirmation requires authentication', function () {
    $response = $this->get(route('password.confirm'));

    $response->assertRedirect(route('login'));
});

// ================================================================
// SECTION 3 — PASSWORD RESET
// Source: PasswordResetTest.php
// ================================================================

beforeEach(function () {
    $this->skipUnlessFortifyFeature(Features::resetPasswords());
});

// ── TC-AUTH-09 ──────────────────────────────────────────────────
// Input  : GET /forgot-password
// Output : Reset password link screen renders HTTP 200
test('TC-AUTH-09: reset password link screen can be rendered', function () {
    $response = $this->get(route('password.request'));

    $response->assertOk();
});

// ── TC-AUTH-10 ──────────────────────────────────────────────────
// Input  : POST /forgot-password with registered email
// Output : ResetPassword notification sent to user email
test('TC-AUTH-10: reset password link can be requested for registered email', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post(route('password.email'), ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class);
});

// ── TC-AUTH-11 ──────────────────────────────────────────────────
// Input  : Valid reset token from email notification
// Output : Reset password screen renders HTTP 200
test('TC-AUTH-11: reset password screen can be rendered with valid token', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post(route('password.email'), ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class, function ($notification) {
        $response = $this->get(route('password.reset', $notification->token));

        $response->assertOk();

        return true;
    });
});

// ── TC-AUTH-12 ──────────────────────────────────────────────────
// Input  : Valid token, email, new password via POST /reset-password
// Output : Password updated, redirected to login
test('TC-AUTH-12: password can be reset with valid token', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post(route('password.email'), ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
        $response = $this->post(route('password.update'), [
            'token'                 => $notification->token,
            'email'                 => $user->email,
            'password'              => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertSessionHasNoErrors()
                 ->assertRedirect(route('login'));

        return true;
    });
});

// ── TC-AUTH-13 ──────────────────────────────────────────────────
// Input  : Invalid token string with valid email and password
// Output : Session error on email field, password unchanged
test('TC-AUTH-13: password cannot be reset with invalid token', function () {
    $user = User::factory()->create();

    $response = $this->post(route('password.update'), [
        'token'                 => 'invalid-token',
        'email'                 => $user->email,
        'password'              => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ]);

    $response->assertSessionHasErrors('email');
});

// ================================================================
// SECTION 4 — TWO FACTOR AUTHENTICATION
// Source: TwoFactorChallengeTest.php
// ================================================================

// ── TC-AUTH-14 ──────────────────────────────────────────────────
// Input  : Unauthenticated GET /two-factor-challenge
// Output : Redirected to login page
test('TC-AUTH-14: two factor challenge redirects to login when not authenticated', function () {
    $this->skipUnlessFortifyFeature(Features::twoFactorAuthentication());

    $response = $this->get(route('two-factor.login'));

    $response->assertRedirect(route('login'));
});

// ── TC-AUTH-15 ──────────────────────────────────────────────────
// Input  : User with 2FA enabled logs in
// Output : Two factor challenge screen rendered HTTP 200
test('TC-AUTH-15: two factor challenge screen can be rendered for 2fa enabled user', function () {
    $this->skipUnlessFortifyFeature(Features::twoFactorAuthentication());

    Features::twoFactorAuthentication([
        'confirm'         => true,
        'confirmPassword' => true,
    ]);

    $user = User::factory()->create();

    $user->forceFill([
        'two_factor_secret'         => encrypt('test-secret'),
        'two_factor_recovery_codes' => encrypt(json_encode(['code1', 'code2'])),
        'two_factor_confirmed_at'   => now(),
    ])->save();

    $this->post(route('login'), [
        'email'    => $user->email,
        'password' => 'password',
    ]);

    $this->get(route('two-factor.login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/two-factor-challenge'),
        );
});

// ================================================================
// SECTION 5 — API AUTHENTICATION (MOBILE)
// Source: New tests for Sanctum API + push token management
// ================================================================

// ── TC-AUTH-16 ──────────────────────────────────────────────────
// Input  : Valid email and password via POST /api/login
// Output : JSON with sanctum token and user object
test('TC-AUTH-16: api login returns sanctum token and user object', function () {
    $user = User::factory()->create([
        'email'    => 'ahmad@gmail.com',
        'password' => bcrypt('password'),
        'role'     => 'villager',
    ]);

    $response = $this->postJson('/api/login', [
        'email'    => 'ahmad@gmail.com',
        'password' => 'password',
    ]);

    $response->assertStatus(200)
             ->assertJsonStructure([
                 'token',
                 'user' => ['id', 'name', 'email', 'role'],
             ]);

    expect($response->json('token'))->not->toBeEmpty();
    expect($response->json('user.role'))->toBe('villager');
});

// ── TC-AUTH-17 ──────────────────────────────────────────────────
// Input  : Valid API login with named user
// Output : Response contains correct user name and email fields
test('TC-AUTH-17: api login returns correct user name and email in response', function () {
    $user = User::factory()->create([
        'name'     => 'Ahmad Zaki',
        'email'    => 'ahmad@gmail.com',
        'password' => bcrypt('password'),
    ]);

    $response = $this->postJson('/api/login', [
        'email'    => 'ahmad@gmail.com',
        'password' => 'password',
    ]);

    $response->assertStatus(200);
    expect($response->json('user.name'))->toBe('Ahmad Zaki');
    expect($response->json('user.email'))->toBe('ahmad@gmail.com');
});

// ── TC-AUTH-18 ──────────────────────────────────────────────────
// Input  : Valid bearer token + expo push token string
// Output : Push token saved to user record in database
test('TC-AUTH-18: authenticated user can save expo push token via api', function () {
    $user = User::factory()->create([
        'password' => bcrypt('password'),
    ]);

    $loginResponse = $this->postJson('/api/login', [
        'email'    => $user->email,
        'password' => 'password',
    ]);

    $token = $loginResponse->json('token');

    $response = $this->withHeader('Authorization', "Bearer {$token}")
                     ->postJson('/api/push-token', [
                         'token' => 'ExponentPushToken[abc123def456]',
                     ]);

    $response->assertStatus(200);

    $user->refresh();
    expect($user->push_token)->toBe('ExponentPushToken[abc123def456]');
});

// ── TC-AUTH-19 ──────────────────────────────────────────────────
// Input  : API logout with valid bearer token
// Output : Push token cleared from user record in database
test('TC-AUTH-19: api logout clears push token from user record', function () {
    $user = User::factory()->create([
        'password'   => bcrypt('password'),
        'push_token' => 'ExponentPushToken[test-token-123]',
    ]);

    $loginResponse = $this->postJson('/api/login', [
        'email'    => $user->email,
        'password' => 'password',
    ]);

    $token = $loginResponse->json('token');

    $this->withHeader('Authorization', "Bearer {$token}")
         ->postJson('/api/logout');

    $user->refresh();
    expect($user->push_token)->toBeNull();
});

// ── TC-AUTH-20 ──────────────────────────────────────────────────
// Input  : Valid bearer token via GET /api/profile
// Output : JSON response with authenticated user data
test('TC-AUTH-20: api profile endpoint returns authenticated user data', function () {
    $user = User::factory()->create([
        'name'     => 'Ahmad Zaki',
        'email'    => 'ahmad@gmail.com',
        'password' => bcrypt('password'),
        'role'     => 'villager',
    ]);

    $loginResponse = $this->postJson('/api/login', [
        'email'    => 'ahmad@gmail.com',
        'password' => 'password',
    ]);

    $apiToken = $loginResponse->json('token');

    $response = $this->withHeader('Authorization', "Bearer {$apiToken}")
                     ->getJson('/api/profile');

    $response->assertStatus(200)
             ->assertJsonStructure(['id', 'name', 'email', 'role']);

    expect($response->json('name'))->toBe('Ahmad Zaki');
    expect($response->json('role'))->toBe('villager');
});

// ── TC-AUTH-21 ──────────────────────────────────────────────────
// Input  : POST /api/login with wrong password
// Output : 401 response with invalid credentials message
test('TC-AUTH-21: api login returns 401 when password is wrong', function () {
    $user = User::factory()->create([
        'password' => bcrypt('correctpassword'),
    ]);

    $response = $this->postJson('/api/login', [
        'email'    => $user->email,
        'password' => 'wrongpassword',
    ]);

    $response->assertStatus(401)
             ->assertJson(['message' => 'Invalid credentials']);
});

// ── TC-AUTH-22 ──────────────────────────────────────────────────
// Input  : POST /api/login with email that does not exist
// Output : 401 response with invalid credentials message
test('TC-AUTH-22: api login returns 401 when email does not exist', function () {
    $response = $this->postJson('/api/login', [
        'email'    => 'notexist@gmail.com',
        'password' => 'password',
    ]);

    $response->assertStatus(401)
             ->assertJson(['message' => 'Invalid credentials']);
});

// ── TC-AUTH-23 ──────────────────────────────────────────────────
// Input  : POST /api/logout without Authorization header
// Output : 401 Unauthenticated response
test('TC-AUTH-23: api logout returns 401 when no token is provided', function () {
    $response = $this->postJson('/api/logout');

    $response->assertStatus(401);
});

// ── TC-AUTH-24 ──────────────────────────────────────────────────
// Input  : POST /api/push-token without Authorization header
// Output : 401 Unauthenticated response
test('TC-AUTH-24: push token endpoint returns 401 for unauthenticated request', function () {
    $response = $this->postJson('/api/push-token', [
        'token' => 'ExponentPushToken[abc123]',
    ]);

    $response->assertStatus(401);
});

// ── TC-AUTH-25 ──────────────────────────────────────────────────
// Input  : POST /api/push-token with empty token field
// Output : 422 Unprocessable Entity validation error
test('TC-AUTH-25: push token endpoint returns 422 when token field is empty', function () {
    $user = User::factory()->create(['password' => bcrypt('password')]);

    $loginResponse = $this->postJson('/api/login', [
        'email'    => $user->email,
        'password' => 'password',
    ]);

    $apiToken = $loginResponse->json('token');

    $response = $this->withHeader('Authorization', "Bearer {$apiToken}")
                     ->postJson('/api/push-token', [
                         'token' => '',
                     ]);

    $response->assertStatus(422);
});

// ── TC-AUTH-26 ──────────────────────────────────────────────────
// Input  : Villager user GET /admin/broadcasting
// Output : 302 redirect — villager is redirected away from admin
//          Your middleware redirects instead of returning 403
test('TC-AUTH-26: villager user cannot access admin broadcasting page', function () {
    $villager = User::factory()->create([
        'role'     => 'villager',
        'password' => bcrypt('password'),
    ]);

    $response = $this->actingAs($villager)
                     ->get('/admin/broadcasting');

    // App redirects villagers away from admin routes (302)
    // rather than returning 403 Forbidden
    $response->assertStatus(302);
});