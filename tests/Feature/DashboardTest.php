<?php

use App\Models\Notification as NotificationModel;
use App\Models\PersonalAccessToken;
use App\Models\User;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('admin users are redirected to admin dashboard', function () {
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'role' => 'admin',
    ]);
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('admin.dashboard'));
});

test('api notifications return json for authenticated mobile clients', function () {
    $user = User::factory()->create([
        'role' => 'villager',
        'email_verified_at' => now(),
    ]);

    NotificationModel::create([
        'type' => 'darurat',
        'notifiable_id' => $user->getKey(),
        'notifiable_type' => User::class,
        'data' => [
            'type' => 'darurat',
            'title' => 'Testing 1',
            'message' => 'Test description',
            'channel' => 'aplikasi',
        ],
    ]);

    $plainToken = 'mobile-test-token';
    $token = PersonalAccessToken::create([
        'tokenable_id' => $user->getKey(),
        'tokenable_type' => User::class,
        'name' => 'mobile',
        'token' => hash('sha256', $plainToken),
        'abilities' => ['*'],
    ]);

    $response = $this->withHeader('Authorization', 'Bearer ' . $token->getKey() . '|' . $plainToken)
        ->getJson('/api/notifications');

    $response->assertOk()
        ->assertJsonFragment(['title' => 'Testing 1'])
        ->assertHeader('content-type', 'application/json');
});