<?php

use App\Jobs\SyncMetaInsights;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Support\Facades\Queue;

it('keeps background translation traffic out of Meta connection and sync limits', function () {
    Queue::fake();
    config(['meta.facebook.app_id' => 'test-app', 'meta.facebook.app_secret' => 'test-secret']);
    $admin = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $this->actingAs($admin);

    // Even invalid translation requests consume the route limiter, without invoking a provider.
    for ($i = 0; $i < 12; $i++) {
        $this->postJson('/website/translate', [])->assertUnprocessable();
    }

    $this->get('/admin/social/facebook/connect?insights=1')->assertRedirectContains('facebook.com/');
    $this->get('/admin/social/instagram/connect?insights=1')->assertRedirectContains('facebook.com/');
    $this->post('/admin/analytics/meta/sync')->assertRedirect();
    $this->post('/admin/analytics/meta/sync')->assertRedirect();
    $this->post('/admin/analytics/meta/sync')->assertStatus(429)->assertHeader('Retry-After');
    $this->get('/admin/social/facebook/connect?insights=1')->assertRedirectContains('facebook.com/');
    Queue::assertPushed(SyncMetaInsights::class);
});

it('still throttles excessive Meta connection starts', function () {
    config(['meta.facebook.app_id' => 'test-app', 'meta.facebook.app_secret' => 'test-secret']);
    $admin = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $this->actingAs($admin);
    for ($i = 0; $i < 10; $i++) {
        $this->get('/admin/social/facebook/connect')->assertRedirectContains('facebook.com/');
    }
    $this->get('/admin/social/instagram/connect')->assertStatus(429)->assertHeader('Retry-After');
});
