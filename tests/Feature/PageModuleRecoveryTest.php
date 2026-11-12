<?php

use App\Models\User;
use App\Models\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

test('guests can load the homepage and login but must sign in for admin', function () {
    $this->get('/')->assertOk()->assertInertia(fn (Assert $page) => $page->component('welcome'));
    $this->get('/login')->assertOk()->assertInertia(fn (Assert $page) => $page->component('auth/login'));
    $this->get('/admin/dashboard')->assertRedirect('/login');
});

test('authenticated admins can load the homepage and admin dashboard', function () {
    $admin = User::factory()->create([
        'roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey(),
    ]);

    $this->actingAs($admin)->get('/')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('welcome'));
    $this->get('/admin/dashboard')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/dashboard'));
    $this->get('/login')->assertRedirect('/dashboard');
});

test('authenticated villagers can load home but cannot access the admin dashboard', function () {
    $this->actingAs(User::factory()->create())->get('/')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('welcome'));
    $this->get('/admin/dashboard')->assertRedirect('/');
    $this->get('/login')->assertRedirect('/dashboard');
});
