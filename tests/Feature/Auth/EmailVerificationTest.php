<?php

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;

test('profile resend sends to the saved email and opens the verification page', function (bool $verifiedPhone) {
    Notification::fake();
    $user = User::factory()->create();

    if ($verifiedPhone) {
        $user->phoneRecord()->create([
            'phone' => '+1234567890',
            'phone_verified_at' => now(),
        ]);
    }

    $this->actingAs($user)->patch(route('profile.update'), [
        'name' => $user->name,
        'email' => 'profile@example.com',
    ])->assertSessionHasNoErrors();

    $user->refresh();

    $this->from(route('profile.edit'))
        ->post(route('verification.send'))
        ->assertRedirect(route('verification.notice'))
        ->assertSessionHas('status', 'verification-link-sent');

    Notification::assertSentTo($user, VerifyEmail::class, function ($notification, $channels) use ($user) {
        return in_array('mail', $channels)
            && $user->routeNotificationFor('mail', $notification) === 'profile@example.com'
            && $user->getEmailForVerification() === 'profile@example.com';
    });

    $this->get(route('verification.notice'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/verify-email')
            ->where('hasEmail', true));

    $this->get(URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), [
        'id' => $user->getKey(),
        'hash' => sha1('profile@example.com'),
    ]))->assertRedirect();

    expect($user->fresh()->email_verified_at)->not->toBeNull();
})->with([false, true]);

test('verified phone-only users remain verified', function () {
    $user = User::factory()->create();
    $user->emailRecord()->delete();
    $user->phoneRecord()->create([
        'phone' => '+1234567890',
        'phone_verified_at' => now(),
    ]);

    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});
