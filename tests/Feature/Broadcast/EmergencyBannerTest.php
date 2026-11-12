<?php

use App\Models\Broadcast;
use App\Models\BroadcastCategory;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('public emergency broadcasts include all published alerts strictly within 24 hours', function () {
    $this->freezeTime();
    $user = User::factory()->create();
    $category = BroadcastCategory::firstOrCreate(['name' => 'darurat']);
    $make = fn (array $attributes = []) => Broadcast::create(array_merge([
        'created_by' => $user->getKey(), 'categoryID' => $category->getKey(),
        'title' => 'Peringatan banjir', 'message' => "Segera mengungsi.\nPosko tersedia.",
        'status' => 'dikirim', 'sent_at' => now()->subHour(),
    ], $attributes));
    $first = $make();
    $second = $make(['sent_at' => now()->subHours(23)]);
    $make(['sent_at' => now()->subHours(24)]);
    $make(['sent_at' => now()->addMinute()]);
    $make(['sent_at' => null]);
    $make(['status' => 'terjadwal']);
    $make(['archived_at' => now()]);
    $make(['categoryID' => BroadcastCategory::firstOrCreate(['name' => 'pengumuman'])->getKey()]);

    $this->get('/')->assertInertia(fn (Assert $page) => $page
        ->has('emergencyBroadcasts', 2)
        ->where('emergencyBroadcasts.0.id', (string) $first->getKey())
        ->where('emergencyBroadcasts.1.id', (string) $second->getKey()));
    $this->getJson('/api/broadcasts/darurat')->assertOk()
        ->assertJsonCount(2, 'broadcasts')
        ->assertJsonPath('broadcasts.0.message', $first->message)
        ->assertJsonPath('broadcasts.0.expiresAt', $first->sent_at->copy()->addHours(24)->toISOString());

    $this->travel(25)->hours();
    $this->getJson('/api/broadcasts/darurat')->assertOk()->assertJsonCount(0, 'broadcasts')->assertJsonPath('message', null);
});

test('broadcast management requires an authenticated admin', function () {
    $this->get('/admin/broadcasting')->assertRedirect('/login');
    $user = User::factory()->create();
    $this->actingAs($user)->get('/admin/broadcasting')->assertRedirect('/');
    $this->actingAs($user)->post('/admin/broadcasting', [])->assertRedirect('/');
    $moderator = User::factory()->create(['roleID' => \App\Models\UserRole::firstOrCreate(['name' => 'moderator'])->getKey()]);
    $this->actingAs($moderator)->post('/admin/broadcasting', [])->assertRedirect(route('admin.dashboard'));
    $admin = User::factory()->create(['roleID' => \App\Models\UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $this->actingAs($admin)->get('/admin/broadcasting/create')->assertOk();
});

