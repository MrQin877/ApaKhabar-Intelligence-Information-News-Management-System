<?php

// ================================================================
// ApaKhabar — Module 5: Notification Delivery
// File: tests/Feature/Broadcast/NotificationDeliveryTest.php
//
// Generate with:
//   php artisan make:test Feature/Broadcast/NotificationDeliveryTest
//
// Module Overview:
//   This module handles delivery of broadcasts through multiple
//   channels — WhatsApp, SMS and in-app notifications.
//   It also handles broadcast status updates and villager
//   notification management.
//
// Based on Logic Flow Diagram (Image 2):
//   - System reads broadcast record from DB
//   - Send via WhatsApp if selected
//   - Send via SMS if selected
//   - Send via in-app (aplikasi) if selected
//   - Update broadcast status as dikirim or failed
//   - Villager receives and views notifications
//   - Villager marks notification as read
//
// Inputs:
//   - Broadcast record from MongoDB
//   - User push_token for mobile notifications
//   - User phone + phone_verified_at for SMS
//
// Outputs:
//   - In-app notification saved to MongoDB notifications collection
//   - Broadcast status updated to dikirim
//   - Villager notification list returned
//   - Notification marked as read
//
// Positive Test Cases : TC-NOTIF-01 to TC-NOTIF-08
// Negative Test Cases : TC-NOTIF-09 to TC-NOTIF-12
// ================================================================

use App\Models\Broadcast;
use App\Models\Notification;
use App\Models\User;
use App\Services\SmsService;
use Illuminate\Support\Facades\Http;

// ── Shared setup ────────────────────────────────────────────────
beforeEach(function () {
    $this->moderator = User::factory()->create([
        'roleID' => \App\Models\UserRole::firstOrCreate(['name' => 'moderator'])->getKey(),
        'password' => bcrypt('Password123!'),
    ]);

    $this->villager = User::factory()->create([
        'roleID' => \App\Models\UserRole::firstOrCreate(['name' => 'villager'])->getKey(),
        'password' => bcrypt('Password123!'),
    ]);
});

// ================================================================
// POSITIVE TEST CASES
// ================================================================

// ── TC-NOTIF-01 ─────────────────────────────────────────────────
// Input  : Broadcast sent with aplikasi channel
// Output : In-app notification saved to MongoDB for each target user
test('TC-NOTIF-01: in-app notification is saved when broadcast is sent via aplikasi channel', function () {
    $this->actingAs($this->moderator)
         ->post('/admin/broadcasting', [
             'title'     => 'Ujian Notifikasi',
             'message'   => 'Ini adalah ujian notifikasi dalam aplikasi.',
             'category'  => 'pengumuman',
             'channels'  => ['aplikasi'],
             'audience'  => 'semua',
             'send_mode' => 'now',
         ]);

    // In-app notification must be saved to MongoDB
    $notification = Notification::where('notifiable_id', (string) $this->villager->id)
        ->first();

    expect($notification)->not->toBeNull();
});

// ── TC-NOTIF-02 ─────────────────────────────────────────────────
// Input  : Broadcast sent with send_mode now
// Output : Broadcast status updated to dikirim
test('TC-NOTIF-02: broadcast status is set to dikirim when sent immediately', function () {
    $this->actingAs($this->moderator)
         ->post('/admin/broadcasting', [
             'title'     => 'Ujian Status',
             'message'   => 'Mesej ujian status.',
             'category'  => 'pengumuman',
             'channels'  => ['aplikasi'],
             'audience'  => 'semua',
             'send_mode' => 'now',
         ]);

    $broadcast = Broadcast::where('title', 'Ujian Status')->first();

    expect($broadcast)->not->toBeNull();
    expect($broadcast->status)->toBe('dikirim');
    expect($broadcast->sent_at)->not->toBeNull();
});

// ── TC-NOTIF-03 ─────────────────────────────────────────────────
// Input  : Broadcast sent to karyawan audience
// Output : Notification saved only for admin and moderator users
//          not for villager users
test('TC-NOTIF-03: notification is only sent to karyawan when audience is karyawan', function () {
    $this->actingAs($this->moderator)
         ->post('/admin/broadcasting', [
             'title'     => 'Mesyuarat Kakitangan',
             'message'   => 'Sila hadir jam 9 pagi.',
             'category'  => 'pengumuman',
             'channels'  => ['aplikasi'],
             'audience'  => 'karyawan',
             'send_mode' => 'now',
         ]);

    // Villager must NOT receive notification for karyawan broadcast
    $villagerNotification = Notification::where('notifiable_id', (string) $this->villager->id)
        ->first();

    expect($villagerNotification)->toBeNull();

    // Moderator MUST receive notification
    $moderatorNotification = Notification::where('notifiable_id', (string) $this->moderator->id)
        ->first();

    expect($moderatorNotification)->not->toBeNull();
});

// ── TC-NOTIF-04 ─────────────────────────────────────────────────
// Input  : Broadcast sent to semua audience
// Output : Notification saved for both villager and moderator
test('TC-NOTIF-04: notification is sent to all users when audience is semua', function () {
    $this->actingAs($this->moderator)
         ->post('/admin/broadcasting', [
             'title'     => 'Pengumuman Semua',
             'message'   => 'Mesej untuk semua pengguna.',
             'category'  => 'pengumuman',
             'channels'  => ['aplikasi'],
             'audience'  => 'semua',
             'send_mode' => 'now',
         ]);

    // Both villager and moderator must receive notification
    $villagerNotif = Notification::where('notifiable_id', (string) $this->villager->id)->first();
    $moderatorNotif = Notification::where('notifiable_id', (string) $this->moderator->id)->first();

    expect($villagerNotif)->not->toBeNull();
    expect($moderatorNotif)->not->toBeNull();
});

// ── TC-NOTIF-05 ─────────────────────────────────────────────────
// Input  : Villager GET /notifications
// Output : Notification list page renders with HTTP 200
test('TC-NOTIF-05: villager can view notifications page', function () {
    $response = $this->actingAs($this->villager)
                     ->get('/notifications');

    $response->assertStatus(200);
});

// ── TC-NOTIF-06 ─────────────────────────────────────────────────
// Input  : Villager GET /api/notifications via API
// Output : JSON list of notifications returned
test('TC-NOTIF-06: api returns notification list for authenticated villager', function () {
    $loginResponse = $this->postJson('/api/login', [
        'email'    => $this->villager->email,
        'password' => 'Password123!',
    ]);

    $token = $loginResponse->json('token');

    $response = $this->withHeader('Authorization', "Bearer {$token}")
                     ->getJson('/api/notifications');

    $response->assertStatus(200);
});

// ── TC-NOTIF-07 ─────────────────────────────────────────────────
// Input  : Villager PATCH /api/notifications/{id}/read
// Output : Notification read_at field updated
test('TC-NOTIF-07: villager can mark a notification as read', function () {
    // Create a notification for villager
    $notification = Notification::create([
        'type'           => 'App\\Notifications\\BroadcastNotification',
        'notifiable_id'  => (string) $this->villager->id,
        'notifiable_type'=> 'App\\Models\\User',
        'data'           => ['title' => 'Test', 'message' => 'Test notif'],
        'read_at'        => null,
    ]);

    $loginResponse = $this->postJson('/api/login', [
        'email'    => $this->villager->email,
        'password' => 'Password123!',
    ]);

    $token = $loginResponse->json('token');

    $response = $this->withHeader('Authorization', "Bearer {$token}")
                     ->patchJson("/api/notifications/{$notification->getKey()}/read");

    $response->assertStatus(200);

    $notification->refresh();
    expect($notification->read_at)->not->toBeNull();
});

// ── TC-NOTIF-08 ─────────────────────────────────────────────────
// Input  : Villager PATCH /api/notifications/read-all
// Output : All unread notifications for user marked as read
test('TC-NOTIF-08: villager can mark all notifications as read', function () {
    // Create two unread notifications for villager
    Notification::create([
        'type'            => 'App\\Notifications\\BroadcastNotification',
        'notifiable_id'   => (string) $this->villager->id,
        'notifiable_type' => 'App\\Models\\User',
        'data'            => ['title' => 'Notif 1', 'message' => 'Mesej 1'],
        'read_at'         => null,
    ]);

    Notification::create([
        'type'            => 'App\\Notifications\\BroadcastNotification',
        'notifiable_id'   => (string) $this->villager->id,
        'notifiable_type' => 'App\\Models\\User',
        'data'            => ['title' => 'Notif 2', 'message' => 'Mesej 2'],
        'read_at'         => null,
    ]);

    $loginResponse = $this->postJson('/api/login', [
        'email'    => $this->villager->email,
        'password' => 'Password123!',
    ]);

    $token = $loginResponse->json('token');

    $response = $this->withHeader('Authorization', "Bearer {$token}")
                     ->patchJson('/api/notifications/read-all');

    $response->assertStatus(200);

    // All notifications must be marked as read
    $unread = Notification::where('notifiable_id', (string) $this->villager->id)
        ->whereNull('read_at')
        ->count();

    expect($unread)->toBe(0);
});

// ================================================================
// NEGATIVE TEST CASES
// ================================================================

// ── TC-NOTIF-09 ─────────────────────────────────────────────────
// Input  : Unauthenticated GET /notifications
// Output : Redirected to login page
test('TC-NOTIF-09: unauthenticated user cannot view notifications page', function () {
    $response = $this->get('/notifications');

    $response->assertRedirect(route('login'));
});

// ── TC-NOTIF-10 ─────────────────────────────────────────────────
// Input  : Unauthenticated GET /api/notifications
// Output : 401 Unauthenticated response
test('TC-NOTIF-10: api returns 401 for unauthenticated notifications request', function () {
    $response = $this->getJson('/api/notifications');

    $response->assertStatus(401);
});

// ── TC-NOTIF-11 ─────────────────────────────────────────────────
// Input  : SMS channel selected but SmsService sendSms returns false
// Output : Broadcast still saved, redirect successful
// Note   : Use instance swap via app()->bind() so the mock is
//          resolved when BroadcastController calls app(SmsService)
test('TC-NOTIF-11: broadcast is saved even when sms delivery fails', function () {
    // Bind mock into the service container so app(SmsService::class)
    // resolves to our mock inside BroadcastController
    $mock = Mockery::mock(SmsService::class);
    $mock->shouldReceive('sendSms')
         ->andReturn(false);  // simulate SMS failure without throwing
    $mock->shouldReceive('sendWhatsAppGroup')
         ->andReturn(false);

    app()->instance(SmsService::class, $mock);

    // Create villager with verified phone
    $this->villager->update([
        'phone'             => '+60109357626',
        'phone_verified_at' => now(),
    ]);

    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'     => 'Ujian SMS Gagal',
                         'message'   => 'Mesej ujian.',
                         'category'  => 'pengumuman',
                         'channels'  => ['sms', 'aplikasi'],
                         'audience'  => 'semua',
                         'send_mode' => 'now',
                     ]);

    // Broadcast must still be saved despite SMS failure
    $broadcast = Broadcast::where('title', 'Ujian SMS Gagal')->first();
    expect($broadcast)->not->toBeNull();

    // Must redirect successfully
    $response->assertRedirect('/admin/broadcasting');
});

// ── TC-NOTIF-12 ─────────────────────────────────────────────────
// Input  : Unauthenticated PATCH /api/notifications/{id}/read
// Output : 401 Unauthenticated response
test('TC-NOTIF-12: api returns 401 when marking notification as read without auth', function () {
    $response = $this->patchJson('/api/notifications/someid/read');

    $response->assertStatus(401);
});