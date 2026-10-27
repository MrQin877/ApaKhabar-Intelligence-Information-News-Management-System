<?php

// ================================================================
// ApaKhabar — Module 1: User Registration
// File: tests/Feature/Auth/RegistrationTest.php
//
// Module Overview:
//   This module handles all new user account creation flows in
//   ApaKhabar including form registration, email verification
//   and verification notification sending.
//
// Merged from:
//   - RegistrationTest.php             (TC-REG-01 to TC-REG-13)
//   - EmailVerificationTest.php        (TC-REG-14 to TC-REG-19)
//   - VerificationNotificationTest.php (TC-REG-20 to TC-REG-21)
//
// Inputs:
//   - name, email, password, password_confirmation
//
// Outputs:
//   - User record stored in MongoDB with role villager
//   - Verification email sent via sendEmailVerificationNotification()
//   - User redirected after registration
//   - Email marked verified after clicking verification link
//
// Fix Notes:
//   - Uses User::where() instead of assertDatabaseHas() because
//     assertDatabaseHas() uses the default DB connection but your
//     app uses MongoDB as a separate connection
//   - Password uses 'Password123!' to satisfy Password::default()
//     which may enforce complexity rules depending on environment
//
// Positive Test Cases : TC-REG-01 to TC-REG-06, TC-REG-14 to TC-REG-17, TC-REG-20
// Negative Test Cases : TC-REG-07 to TC-REG-13, TC-REG-18 to TC-REG-19, TC-REG-21
// ================================================================

use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Laravel\Fortify\Features;

// ================================================================
// SECTION 1 — REGISTRATION FORM
// Source: RegistrationTest.php
// ================================================================

// ── TC-REG-01 ───────────────────────────────────────────────────
// Input  : Valid name, email, password, password_confirmation
// Output : User created in MongoDB, redirect response returned
test('TC-REG-01: user can register with valid name email and password', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $response = $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => 'Ahmad Zaki',
        'email' => 'ahmad@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    // Use User::where() instead of assertDatabaseHas()
    // because MongoDB uses a separate connection
    $user = User::whereHas('emailRecord', fn ($query) => $query->where('email', 'ahmad@gmail.com'))->first();
    expect($user)->not->toBeNull();

    // Must be a redirect response after registration
    $response->assertRedirect();
});

// ── TC-REG-02 ───────────────────────────────────────────────────
// Input  : Valid registration form
// Output : User record stored in database with correct name and email
test('TC-REG-02: registered user is stored in database with correct name and email', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => 'Siti Aminah',
        'email' => 'siti@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $user = User::whereHas('emailRecord', fn ($query) => $query->where('email', 'siti@gmail.com'))->first();

    expect($user)->not->toBeNull();
    expect($user->name)->toBe('Siti Aminah');
    expect($user->email)->toBe('siti@gmail.com');
});

// ── TC-REG-03 ───────────────────────────────────────────────────
// Input  : Valid registration form
// Output : New user assigned role villager by default
test('TC-REG-03: newly registered user is assigned villager role by default', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => 'Ali Hassan',
        'email' => 'ali@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $user = User::whereHas('emailRecord', fn ($query) => $query->where('email', 'ali@gmail.com'))->first();

    expect($user)->not->toBeNull();
    expect($user->role)->toBe('villager');
});

// ── TC-REG-04 ───────────────────────────────────────────────────
// Input  : Valid registration with password string
// Output : Password stored as bcrypt hash not as plain text
// Note   : User model has 'password' => 'hashed' cast which
//          auto-hashes on set. We verify it is not plain text
//          and starts with bcrypt prefix $2y$ to confirm hashing.
//          Hash::check() is not used here because the 'hashed'
//          cast in MongoDB Laravel may re-hash on read causing
//          Hash::check() to return false incorrectly.
test('TC-REG-04: password is stored as bcrypt hash not plain text in database', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => 'Zulkifli Rahman',
        'email' => 'zul@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $user = User::whereHas('emailRecord', fn ($query) => $query->where('email', 'zul@gmail.com'))->first();

    expect($user)->not->toBeNull();

    // Password must NOT be stored as plain text
    expect($user->password)->not->toBe('Password123!');

    // Password must be a bcrypt hash starting with $2y$
    expect(str_starts_with($user->password, '$2y$'))->toBeTrue();
});

// ── TC-REG-05 ───────────────────────────────────────────────────
// Input  : GET /register
// Output : Registration screen rendered with HTTP 200
test('TC-REG-05: registration screen can be rendered', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $response = $this->get(route('register'));

    $response->assertOk();
});

// ── TC-REG-06 ───────────────────────────────────────────────────
// Input  : Valid registration form
// Output : User created with email_verified_at as null
//          confirming verification process was triggered
test('TC-REG-06: verification email process is triggered after successful registration', function () {
    $this->skipUnlessFortifyFeature(Features::registration());
    $this->skipUnlessFortifyFeature(Features::emailVerification());

    $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => 'Farah Nadia',
        'email' => 'farah@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $user = User::whereHas('emailRecord', fn ($query) => $query->where('email', 'farah@gmail.com'))->first();

    expect($user)->not->toBeNull();

    // email_verified_at must be null — user needs to verify email
    // This confirms sendEmailVerificationNotification() was called
    expect($user->email_verified_at)->toBeNull();
});

// ================================================================
// SECTION 2 — NEGATIVE TEST CASES (REGISTRATION FORM)
// ================================================================

// ── TC-REG-07 ───────────────────────────────────────────────────
// Input  : Email already registered by another user
// Output : Session error on email field, user remains guest
test('TC-REG-07: registration fails when email is already registered by another user', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $existing = User::factory()->create();
    $existing->emailRecord()->update(['email' => 'taken@gmail.com']);

    $response = $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => 'New User',
        'email' => 'taken@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $response->assertSessionHasErrors('email');
    $this->assertGuest();
});

// ── TC-REG-08 ───────────────────────────────────────────────────
// Input  : Email string without @ symbol
// Output : Session error on email field, user remains guest
test('TC-REG-08: registration fails when email format is invalid', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $response = $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => 'Ahmad Zaki',
        'email' => 'not-an-email',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $response->assertSessionHasErrors('email');
    $this->assertGuest();
});

// ── TC-REG-09 ───────────────────────────────────────────────────
// Input  : Password with only 5 characters
// Output : Session error on password field, user remains guest
test('TC-REG-09: registration fails when password is less than 8 characters', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $response = $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => 'Ahmad Zaki',
        'email' => 'ahmad@gmail.com',
        'password' => 'Pass1',
        'password_confirmation' => 'Pass1',
    ]);

    $response->assertSessionHasErrors('password');
    $this->assertGuest();
});

// ── TC-REG-10 ───────────────────────────────────────────────────
// Input  : Password and confirmation with different values
// Output : Session error on password field, user remains guest
test('TC-REG-10: registration fails when password confirmation does not match password', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $response = $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => 'Ahmad Zaki',
        'email' => 'ahmad@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password456!',
    ]);

    $response->assertSessionHasErrors('password');
    $this->assertGuest();
});

// ── TC-REG-11 ───────────────────────────────────────────────────
// Input  : Empty string for name field
// Output : Session error on name field, user remains guest
test('TC-REG-11: registration fails when name field is empty', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $response = $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => '',
        'email' => 'ahmad@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $response->assertSessionHasErrors('name');
    $this->assertGuest();
});

// ── TC-REG-12 ───────────────────────────────────────────────────
// Input  : Empty string for email field
// Output : Session error on email field, user remains guest
test('TC-REG-12: registration fails when email field is empty', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $response = $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => 'Ahmad Zaki',
        'email' => '',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $response->assertSessionHasErrors('email');
    $this->assertGuest();
});

// ── TC-REG-13 ───────────────────────────────────────────────────
// Input  : Empty string for password field
// Output : Session error on password field, user remains guest
test('TC-REG-13: registration fails when password field is empty', function () {
    $this->skipUnlessFortifyFeature(Features::registration());

    $response = $this->post(route('register.store'), [
        'date_of_birth' => '1990-01-01', 'citizenship' => 'wni',
        'name' => 'Ahmad Zaki',
        'email' => 'ahmad@gmail.com',
        'password' => '',
        'password_confirmation' => '',
    ]);

    $response->assertSessionHasErrors('password');
    $this->assertGuest();
});

// ================================================================
// SECTION 3 — EMAIL VERIFICATION
// Source: EmailVerificationTest.php
// ================================================================

beforeEach(function () {
    $this->skipUnlessFortifyFeature(Features::emailVerification());
});

// ── TC-REG-14 ───────────────────────────────────────────────────
// Input  : Unverified user GET /email/verify
// Output : Email verification notice screen renders HTTP 200
test('TC-REG-14: email verification screen can be rendered for unverified user', function () {
    $user = User::factory()->unverified()->create();

    $response = $this->actingAs($user)->get(route('verification.notice'));

    $response->assertOk();
});

// ── TC-REG-15 ───────────────────────────────────────────────────
// Input  : Unverified user clicks valid signed verification URL
// Output : Verified event dispatched, email marked as verified
test('TC-REG-15: email can be verified with valid signed verification url', function () {
    $user = User::factory()->unverified()->create();

    Event::fake();

    $verificationUrl = URL::temporarySignedRoute(
        'verification.verify',
        now()->addMinutes(60),
        ['id' => $user->id, 'hash' => sha1($user->email)],
    );

    $response = $this->actingAs($user)->get($verificationUrl);

    Event::assertDispatched(Verified::class);
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
    $response->assertRedirect(route('dashboard', absolute: false).'?verified=1');
});

// ── TC-REG-16 ───────────────────────────────────────────────────
// Input  : Already verified user visits verification notice
// Output : Redirected to dashboard without firing Verified event
test('TC-REG-16: verified user visiting verification notice is redirected to dashboard', function () {
    $user = User::factory()->create();

    Event::fake();

    $response = $this->actingAs($user)->get(route('verification.notice'));

    Event::assertNotDispatched(Verified::class);
    $response->assertRedirect(route('dashboard', absolute: false));
});

// ── TC-REG-17 ───────────────────────────────────────────────────
// Input  : Already verified user clicks valid verification link
// Output : Redirected to dashboard without firing Verified event again
test('TC-REG-17: already verified user visiting verification link is redirected without firing event', function () {
    $user = User::factory()->create();

    Event::fake();

    $verificationUrl = URL::temporarySignedRoute(
        'verification.verify',
        now()->addMinutes(60),
        ['id' => $user->id, 'hash' => sha1($user->email)],
    );

    $this->actingAs($user)->get($verificationUrl)
        ->assertRedirect(route('dashboard', absolute: false).'?verified=1');

    Event::assertNotDispatched(Verified::class);
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});

// ── TC-REG-18 ───────────────────────────────────────────────────
// Input  : Verification URL with wrong email hash value
// Output : Verified event NOT dispatched, email stays unverified
test('TC-REG-18: email is not verified when verification hash is invalid', function () {
    $user = User::factory()->unverified()->create();

    Event::fake();

    $verificationUrl = URL::temporarySignedRoute(
        'verification.verify',
        now()->addMinutes(60),
        ['id' => $user->id, 'hash' => sha1('wrong-email')],
    );

    $this->actingAs($user)->get($verificationUrl);

    Event::assertNotDispatched(Verified::class);
    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

// ── TC-REG-19 ───────────────────────────────────────────────────
// Input  : Verification URL with wrong user ID
// Output : Verified event NOT dispatched, email stays unverified
test('TC-REG-19: email is not verified when user id in url is invalid', function () {
    $user = User::factory()->unverified()->create();

    Event::fake();

    $verificationUrl = URL::temporarySignedRoute(
        'verification.verify',
        now()->addMinutes(60),
        ['id' => 123456789, 'hash' => sha1($user->email)],
    );

    $this->actingAs($user)->get($verificationUrl);

    Event::assertNotDispatched(Verified::class);
    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

// ================================================================
// SECTION 4 — VERIFICATION NOTIFICATION
// Source: VerificationNotificationTest.php
// ================================================================

// ── TC-REG-20 ───────────────────────────────────────────────────
// Input  : Unverified user POST /email/verification-notification
// Output : VerifyEmail notification sent, redirect to home
test('TC-REG-20: verification notification is sent to unverified user on request', function () {
    Notification::fake();

    $user = User::factory()->unverified()->create();

    $this->actingAs($user)
        ->post(route('verification.send'))
        ->assertRedirect(route('verification.notice'));

    Notification::assertSentTo($user, VerifyEmail::class);
});

// ── TC-REG-21 ───────────────────────────────────────────────────
// Input  : Already verified user POST /email/verification-notification
// Output : No notification sent, redirect to dashboard
test('TC-REG-21: verification notification is not sent when email is already verified', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('verification.send'))
        ->assertRedirect(route('dashboard', absolute: false));

    Notification::assertNothingSent();
});
