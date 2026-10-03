<?php

// ================================================================
// ApaKhabar — Module 4: Broadcast Emergency Alert
// File: tests/Feature/Broadcast/BroadcastTest.php
//
// Generate with:
//   php artisan make:test Feature/Broadcast/BroadcastTest
//
// Module Overview:
//   This module allows moderators to view, filter, archive,
//   resend and create new broadcasts (announcements and
//   emergency alerts).
//
// Based on Logic Flow Diagram (Image 1):
//   - View broadcast list
//   - Filter by category
//   - Archive published announcement
//   - Resend published announcement
//   - Create new broadcast with form validation
//
// Inputs:
//   - title, message, category, audience, channels, send_mode
//
// Outputs:
//   - Broadcast saved to MongoDB
//   - Redirect to broadcast list on success
//   - Session errors on invalid input
//   - 403 Forbidden for non-moderator users
//
// Positive Test Cases : TC-BRD-01 to TC-BRD-09
// Negative Test Cases : TC-BRD-10 to TC-BRD-17
// ================================================================

use App\Models\Broadcast;
use App\Models\User;

// ── Shared setup ────────────────────────────────────────────────
beforeEach(function () {
    foreach (['pengumuman', 'darurat'] as $name) {
        \App\Models\BroadcastCategory::firstOrCreate(['name' => $name]);
    }
    \App\Models\Channel::firstOrCreate(['name' => 'aplikasi']);
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

// ── TC-BRD-01 ───────────────────────────────────────────────────
// Input  : Moderator GET /admin/broadcasting
// Output : Broadcast list page renders with HTTP 200
test('TC-BRD-01: moderator can view broadcast list page', function () {
    $response = $this->actingAs($this->moderator)
                     ->get('/admin/broadcasting');

    $response->assertStatus(200);
});

// ── TC-BRD-02 ───────────────────────────────────────────────────
// Input  : Moderator GET /admin/broadcasting/create
// Output : Broadcast create form renders with HTTP 200
test('TC-BRD-02: moderator can view broadcast create form', function () {
    $response = $this->actingAs($this->moderator)
                     ->get('/admin/broadcasting/create');

    $response->assertStatus(200);
});

// ── TC-BRD-03 ───────────────────────────────────────────────────
// Input  : Valid broadcast form — pengumuman to semua via aplikasi
// Output : Broadcast saved in DB, redirected to broadcast list
test('TC-BRD-03: moderator can create valid pengumuman broadcast', function () {
    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'     => 'Gotong Royong Desa Punggul',
                         'message'   => 'Jemput hadir pada 10 April 2026 jam 8 pagi.',
                         'category'  => 'pengumuman',
                         'channels'  => ['aplikasi'],
                         'audience'  => 'semua',
                         'send_mode' => 'now',
                     ]);

    $response->assertRedirect('/admin/broadcasting');

    $broadcast = Broadcast::where('title', 'Gotong Royong Desa Punggul')->first();
    expect($broadcast)->not->toBeNull();
    expect($broadcast->category)->toBe('pengumuman');
    expect($broadcast->status)->toBe('dikirim');
});

// ── TC-BRD-04 ───────────────────────────────────────────────────
// Input  : Valid darurat broadcast form
// Output : Broadcast saved with category darurat
test('TC-BRD-04: moderator can create valid darurat emergency alert broadcast', function () {
    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'     => 'Amaran Banjir Kilat',
                         'message'   => 'Semua penduduk diminta berhati-hati.',
                         'category'  => 'darurat',
                         'channels'  => ['aplikasi'],
                         'audience'  => 'semua',
                         'send_mode' => 'now',
                     ]);

    $response->assertRedirect('/admin/broadcasting');

    $broadcast = Broadcast::where('title', 'Amaran Banjir Kilat')->first();
    expect($broadcast)->not->toBeNull();
    expect($broadcast->category)->toBe('darurat');
});

// ── TC-BRD-05 ───────────────────────────────────────────────────
// Input  : Valid broadcast form with audience karyawan
// Output : Broadcast saved with audience karyawan
test('TC-BRD-05: moderator can create broadcast targeted to karyawan only', function () {
    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'     => 'Mesyuarat Kakitangan',
                         'message'   => 'Sila hadir jam 9 pagi.',
                         'category'  => 'pengumuman',
                         'channels'  => ['aplikasi'],
                         'audience'  => 'karyawan',
                         'send_mode' => 'now',
                     ]);

    $response->assertRedirect('/admin/broadcasting');

    $broadcast = Broadcast::where('title', 'Mesyuarat Kakitangan')->first();
    expect($broadcast)->not->toBeNull();
    expect($broadcast->load('users.roleRecord')->audience)->toBe('karyawan');
});

// ── TC-BRD-06 ───────────────────────────────────────────────────
// Input  : Valid scheduled broadcast with date and time
// Output : Broadcast saved with status terjadwal
test('TC-BRD-06: moderator can schedule a broadcast for later', function () {
    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'          => 'Program Vaksinasi',
                         'message'        => 'Akan diadakan pada 15 April.',
                         'category'       => 'pengumuman',
                         'channels'       => ['aplikasi'],
                         'audience'       => 'semua',
                         'send_mode'      => 'scheduled',
                         'scheduled_date' => '2026-04-15',
                         'scheduled_time' => '09:00',
                     ]);

    $response->assertRedirect('/admin/broadcasting');

    $broadcast = Broadcast::where('title', 'Program Vaksinasi')->first();
    expect($broadcast)->not->toBeNull();
    expect($broadcast->status)->toBe('terjadwal');
});

// ── TC-BRD-07 ───────────────────────────────────────────────────
// Input  : Moderator POST /admin/broadcasting/{id}/archive
// Output : Broadcast archived, redirected to broadcast list
test('TC-BRD-07: moderator can archive a broadcast', function () {
    $broadcast = Broadcast::create([
        'created_by' => (string) $this->moderator->id,
        'title'      => 'Berita Lama',
        'message'    => 'Kandungan lama.',
        'category'   => 'pengumuman',
        'channels'   => ['aplikasi'],
        'audience'   => 'semua',
        'send_mode'  => 'now',
        'status'     => 'dikirim',
        'sent_at'    => now(),
        'archived_at'=> null,
    ]);

    $response = $this->actingAs($this->moderator)
                     ->post("/admin/broadcasting/{$broadcast->getKey()}/archive");

    $response->assertRedirect('/admin/broadcasting');

    $broadcast->refresh();
    expect($broadcast->archived_at)->not->toBeNull();
});

// ── TC-BRD-08 ───────────────────────────────────────────────────
// Input  : Moderator GET /admin/broadcasting/archived
// Output : Archived broadcast list renders with HTTP 200
test('TC-BRD-08: moderator can view archived broadcast list', function () {
    $response = $this->actingAs($this->moderator)
                     ->get('/admin/broadcasting/archived');

    $response->assertStatus(200);
});

// ── TC-BRD-09 ───────────────────────────────────────────────────
// Input  : Moderator POST /admin/broadcasting/{id}/restore
// Output : Broadcast restored, archived_at set to null
test('TC-BRD-09: moderator can restore an archived broadcast', function () {
    $broadcast = Broadcast::create([
        'created_by'  => (string) $this->moderator->id,
        'title'       => 'Berita Diarkib',
        'message'     => 'Kandungan diarkib.',
        'category'    => 'pengumuman',
        'channels'    => ['aplikasi'],
        'audience'    => 'semua',
        'send_mode'   => 'now',
        'status'      => 'dikirim',
        'sent_at'     => now(),
        'archived_at' => now(),
    ]);

    $response = $this->actingAs($this->moderator)
                     ->post("/admin/broadcasting/{$broadcast->getKey()}/restore");

    $response->assertRedirect();

    $broadcast->refresh();
    expect($broadcast->archived_at)->toBeNull();
});

// ================================================================
// NEGATIVE TEST CASES
// ================================================================

// ── TC-BRD-10 ──────────────────────────────────────────────────
// Input  : Broadcast form with empty title field
// Output : Session error on title field
test('TC-BRD-10: broadcast fails when title field is empty', function () {
    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'     => '',
                         'message'   => 'Kandungan mesej.',
                         'category'  => 'pengumuman',
                         'channels'  => ['aplikasi'],
                         'audience'  => 'semua',
                         'send_mode' => 'now',
                     ]);

    $response->assertSessionHasErrors('title');
});

// ── TC-BRD-11 ──────────────────────────────────────────────────
// Input  : Broadcast form with empty message field
// Output : Session error on message field
test('TC-BRD-11: broadcast fails when message field is empty', function () {
    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'     => 'Test Siaran',
                         'message'   => '',
                         'category'  => 'pengumuman',
                         'channels'  => ['aplikasi'],
                         'audience'  => 'semua',
                         'send_mode' => 'now',
                     ]);

    $response->assertSessionHasErrors('message');
});

// ── TC-BRD-12 ──────────────────────────────────────────────────
// Input  : Broadcast form without category selected
// Output : Session error on category field
test('TC-BRD-12: broadcast fails when category is not selected', function () {
    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'     => 'Test Siaran',
                         'message'   => 'Kandungan mesej.',
                         'category'  => '',
                         'channels'  => ['aplikasi'],
                         'audience'  => 'semua',
                         'send_mode' => 'now',
                     ]);

    $response->assertSessionHasErrors('category');
});

// ── TC-BRD-13 ──────────────────────────────────────────────────
// Input  : Broadcast form with invalid category value
// Output : Session error on category field
test('TC-BRD-13: broadcast fails when category value is invalid', function () {
    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'     => 'Test Siaran',
                         'message'   => 'Kandungan mesej.',
                         'category'  => 'invalid',
                         'channels'  => ['aplikasi'],
                         'audience'  => 'semua',
                         'send_mode' => 'now',
                     ]);

    $response->assertSessionHasErrors('category');
});

// ── TC-BRD-14 ──────────────────────────────────────────────────
// Input  : Broadcast form without audience selected
// Output : Session error on audience field
test('TC-BRD-14: broadcast fails when audience is not selected', function () {
    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'     => 'Test Siaran',
                         'message'   => 'Kandungan mesej.',
                         'category'  => 'pengumuman',
                         'channels'  => ['aplikasi'],
                         'audience'  => '',
                         'send_mode' => 'now',
                     ]);

    $response->assertSessionHasErrors('audience');
});

// ── TC-BRD-15 ──────────────────────────────────────────────────
// Input  : Broadcast form with empty channels array
// Output : Session error on channels field
test('TC-BRD-15: broadcast fails when no channel is selected', function () {
    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'     => 'Test Siaran',
                         'message'   => 'Kandungan mesej.',
                         'category'  => 'pengumuman',
                         'channels'  => [],
                         'audience'  => 'semua',
                         'send_mode' => 'now',
                     ]);

    $response->assertSessionHasErrors('channels');
});

// ── TC-BRD-16 ──────────────────────────────────────────────────
// Input  : Scheduled broadcast without scheduled_date
// Output : Session error on scheduled_date field
test('TC-BRD-16: scheduled broadcast fails when scheduled date is missing', function () {
    $response = $this->actingAs($this->moderator)
                     ->post('/admin/broadcasting', [
                         'title'          => 'Test Siaran',
                         'message'        => 'Kandungan mesej.',
                         'category'       => 'pengumuman',
                         'channels'       => ['aplikasi'],
                         'audience'       => 'semua',
                         'send_mode'      => 'scheduled',
                         'scheduled_date' => '',
                         'scheduled_time' => '09:00',
                     ]);

    $response->assertSessionHasErrors('scheduled_date');
});

// ── TC-BRD-17 ──────────────────────────────────────────────────
// Input  : Villager user tries to access broadcast page
// Output : 302 redirect — villager blocked from admin routes
test('TC-BRD-17: villager user cannot access broadcast management page', function () {
    $response = $this->actingAs($this->villager)
                     ->get('/admin/broadcasting');

    $response->assertStatus(302);
});