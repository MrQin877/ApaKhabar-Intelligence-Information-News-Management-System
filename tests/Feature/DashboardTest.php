<?php

use App\Models\Notification as NotificationModel;
use App\Models\User;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('admin users are redirected to admin dashboard', function () {
    $user = User::factory()->create([
        'roleID' => \App\Models\UserRole::firstOrCreate(['name' => 'admin'])->getKey(),
    ]);
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('admin.dashboard'));
});

test('api notifications return json for authenticated mobile clients', function () {
    $user = User::factory()->create([
        'roleID' => \App\Models\UserRole::firstOrCreate(['name' => 'villager'])->getKey(),
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

    $token = $user->createToken('mobile')->plainTextToken;
    $response = $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/notifications');

    $response->assertOk()
        ->assertJsonFragment(['title' => 'Testing 1'])
        ->assertHeader('content-type', 'application/json');
});