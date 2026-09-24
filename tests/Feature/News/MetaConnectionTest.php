<?php

use App\Models\SocialConnection;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    config([
        'meta.facebook.app_id' => 'test-app', 'meta.facebook.app_secret' => 'test-secret',
        'meta.instagram.app_id' => 'test-instagram', 'meta.instagram.app_secret' => 'instagram-secret',
        'meta.instagram.redirect_uri' => 'http://localhost/admin/social/instagram/callback',
        'meta.graph_version' => 'v25.0',
    ]);
    Http::preventStrayRequests();
});

test('missing configuration does not start authorization or expose app secrets', function () {
    config(['meta.facebook.app_id' => null, 'meta.instagram.app_id' => null]);
    $this->get('/admin/news/manual/create')->assertInertia(fn (Assert $page) => $page
        ->where('metaAuth.facebookAppId', null)->where('metaAuth.instagramConfigured', false)
        ->missing('metaAuth.facebookAppSecret')->missing('metaAuth.instagramAppSecret'));
    $this->postJson('/admin/social/facebook/authorize', ['access_token' => 'unused'])->assertStatus(503);
    $this->get('/admin/social/instagram/connect')->assertStatus(503);
    Http::assertNothingSent();
});

test('facebook validates the app and asks the user to choose a page before connecting', function () {
    Http::fake([
        '*debug_token*' => Http::response(['data' => ['is_valid' => true, 'app_id' => 'test-app', 'scopes' => ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']]]),
        '*oauth/access_token*' => Http::response(['access_token' => 'long-user-token', 'expires_in' => 5000]),
        '*me/accounts*' => Http::response(['data' => [
            ['id' => '123', 'name' => 'Halaman Desa', 'access_token' => 'private-page-token', 'tasks' => ['CREATE_CONTENT']],
            ['id' => '456', 'name' => 'No posting permission', 'access_token' => 'other-token', 'tasks' => ['ANALYZE']],
        ]]),
    ]);
    $response = $this->postJson('/admin/social/facebook/authorize', ['access_token' => 'sdk-token'])
        ->assertOk()->assertJsonCount(1, 'pages')->assertJsonPath('pages.0.name', 'Halaman Desa');
    expect($response->getContent())->not->toContain('private-page-token', 'long-user-token');
    expect(SocialConnection::count())->toBe(0);
    $this->postJson('/admin/social/facebook/page', ['ticket' => $response->json('ticket'), 'page_id' => '123'])
        ->assertOk()->assertJsonPath('platforms.1.status', 'connected')->assertJsonPath('platforms.1.account', 'Halaman Desa');
    $connection = SocialConnection::sole();
    expect($connection->access_token)->toBe('private-page-token')
        ->and($connection->getRawOriginal('access_token'))->not->toBe('private-page-token')
        ->and($connection->toArray())->not->toHaveKey('access_token');
    $this->postJson('/admin/social/facebook/page', ['ticket' => $response->json('ticket'), 'page_id' => '123'])->assertUnprocessable();
});

test('facebook rejects tokens for a different app', function () {
    Http::fake(['*debug_token*' => Http::response(['data' => ['is_valid' => true, 'app_id' => 'another-app']])]);
    $this->postJson('/admin/social/facebook/authorize', ['access_token' => 'untrusted-token'])->assertUnprocessable();
    expect(SocialConnection::count())->toBe(0);
});

test('connection refresh marks revoked tokens expired without leaking tokens', function () {
    SocialConnection::create(['user_id' => auth()->id(), 'platform' => 'facebook', 'account_id' => '123', 'account_name' => 'Desa', 'access_token' => 'private-token', 'expires_at' => now()->addDay()]);
    Http::fake(['*' => Http::response(['error' => ['code' => 190]], 400)]);
    $response = $this->getJson('/admin/social/connections')->assertOk()->assertJsonPath('platforms.1.status', 'expired');
    expect($response->getContent())->not->toContain('private-token');
});

test('instagram authorization uses a time limited state and professional permissions', function () {
    $response = $this->get('/admin/social/instagram/connect')->assertRedirect();
    $location = $response->headers->get('Location');
    parse_str(parse_url($location, PHP_URL_QUERY), $query);
    expect(parse_url($location, PHP_URL_HOST))->toBe('www.instagram.com');
    expect($query['scope'])->toContain('instagram_business_basic', 'instagram_business_content_publish');
    $this->get('/admin/social/instagram/callback?state=forged&code=unused')->assertStatus(419);
    Http::assertNothingSent();
});

test('instagram callback verifies the account and safely returns to the original editor window', function () {
    Http::fake([
        'https://api.instagram.com/oauth/access_token' => Http::response(['access_token' => 'short-token', 'permissions' => ['instagram_business_basic', 'instagram_business_content_publish']]),
        'https://graph.instagram.com/access_token*' => Http::response(['access_token' => 'long-instagram-token', 'expires_in' => 5000]),
        'https://graph.instagram.com/v25.0/me*' => Http::response(['user_id' => '789', 'username' => 'desa']),
    ]);
    $response = $this->get('/admin/social/instagram/connect');
    parse_str(parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);
    $callback = '/admin/social/instagram/callback?'.http_build_query(['state' => $query['state'], 'code' => 'authorization-code']);
    $response = $this->get($callback)->assertOk();
    expect($response->getContent())->toContain('apakhabar:instagram-auth')->not->toContain('long-instagram-token');
    expect(SocialConnection::sole()->account_name)->toBe('@desa');
    $this->get($callback)->assertStatus(419);
});

test('cancelled instagram consent leaves the account disconnected', function () {
    $response = $this->get('/admin/social/instagram/connect');
    parse_str(parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);
    $this->get('/admin/social/instagram/callback?'.http_build_query(['state' => $query['state'], 'error' => 'access_denied']))->assertOk();
    expect(SocialConnection::count())->toBe(0);
    Http::assertNothingSent();
});

test('connection records belong to the signed in author', function () {
    $other = User::factory()->create();
    SocialConnection::create(['user_id' => $other->getKey(), 'platform' => 'instagram', 'account_id' => '987', 'account_name' => '@other', 'access_token' => 'other-secret']);
    $this->getJson('/admin/social/connections')->assertOk()->assertJsonPath('platforms.2.status', 'disconnected');
    Http::assertNothingSent();
});
