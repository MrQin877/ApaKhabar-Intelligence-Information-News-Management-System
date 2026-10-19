<?php

use App\Models\SocialConnection;
use App\Models\User;
use App\Models\UserRole;
use App\Services\FacebookPublishingService;
use App\Services\News\MetaConnections;
use App\Services\News\MetaCredentials;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    // HTTP tests do not retain response cookies automatically.
    $this->withCredentials();
    $this->withCookie(config('session.cookie'), Illuminate\Support\Str::random(40));
    config(['services.instagram.user_id' => null, 'services.instagram.access_token' => null]);
    config(['services.facebook.page_id' => null, 'services.facebook.page_access_token' => null]);
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    config([
        'meta.facebook.app_id' => 'test-app', 'meta.facebook.app_secret' => 'test-secret',
        'meta.facebook.redirect_uri' => 'http://localhost:8000/admin/social/facebook/callback',
        'meta.login_config_ids.facebook' => null, 'meta.login_config_ids.instagram' => null,
        'meta.graph_version' => 'v25.0',
        'meta.instagram_discovery_diagnostics' => false,
    ]);
    Http::preventStrayRequests();
});

test('callback diagnostics allowlist error names and never expose callback secrets', function () {
    config(['meta.instagram_discovery_diagnostics' => true]);
    $records = [];
    Log::shouldReceive('channel')->with('single')->andReturnSelf();
    Log::shouldReceive('info')->andReturnUsing(function ($event, $context) use (&$records) {
        $records[] = ['event' => $event, 'context' => $context];
    });
    $query = startMetaFlow($this, 'facebook');
    $this->get('/admin/social/facebook/callback?'.http_build_query([
        'state' => $query['state'], 'code' => 'private-code', 'error' => 'secret-provider-value',
        'error_description' => 'private-description',
    ]))->assertRedirect();
    $callback = collect($records)->firstWhere('event', 'meta.oauth.callback')['context'];
    expect($callback['callback_reached'])->toBeTrue()->and($callback['state_matches_session'])->toBeTrue()
        ->and($callback['error_name'])->toBe('other')->and($callback['intended_platform'])->toBe('facebook');
    expect(json_encode($records))->not->toContain($query['state'], 'private-code', 'secret-provider-value', 'private-description', 'test-secret');
    expect(SocialConnection::count())->toBe(0);
    Http::assertNothingSent();
});

test('page expiry comes from the selected page token metadata', function ($lifetime) {
    $expiry = $lifetime === 0 ? 0 : now()->addSeconds($lifetime)->timestamp;
    Http::fake(['*debug_token*' => Http::response(['data' => [
        'is_valid' => true, 'app_id' => 'test-app', 'type' => 'PAGE',
        'profile_id' => '123', 'expires_at' => $expiry,
        'data_access_expires_at' => now()->addDay()->timestamp,
    ]])]);
    expect(app(MetaConnections::class)->pageTokenExpiry('selected-page-secret', '123'))
        ->toBe($expiry === 0 ? null : date('Y-m-d H:i:s', $expiry));
    Http::assertSent(fn ($request) => $request['input_token'] === 'selected-page-secret');
})->with([0, 7200]);

test('failed page validation preserves the existing connection', function ($override) {
    $connection = existingMetaConnection('facebook');
    $ticket = str_repeat('e', 48);
    Cache::put('meta-accounts:'.auth()->id().':'.$ticket, Crypt::encryptString(json_encode([
        'platform' => 'facebook', 'pages' => [[
            'id' => '456', 'account_id' => '456', 'account_name' => 'New', 'access_token' => 'new-secret',
        ]],
    ])), 600);
    Http::fake(['*debug_token*' => Http::response(['data' => array_replace([
        'is_valid' => true, 'app_id' => 'test-app', 'type' => 'PAGE', 'profile_id' => '456', 'expires_at' => 0,
    ], $override)])]);
    $this->withSession(['meta_selection' => $ticket])
        ->postJson('/admin/social/meta/account', ['ticket' => $ticket, 'page_id' => '456'])
        ->assertUnprocessable()->assertJsonValidationErrors('connection');
    expect($connection->fresh()->access_token)->toBe('original-secret');
})->with([
    'invalid' => [['is_valid' => false]],
    'wrong app' => [['app_id' => 'other']],
    'wrong page' => [['profile_id' => '999']],
    'user token' => [['type' => 'USER']],
    'missing expiry' => [['expires_at' => null]],
    'expired' => [['expires_at' => 1]],
]);

test('missing configuration does not start authorization or expose app secrets', function () {
    config(['meta.facebook.app_id' => null, 'meta.instagram.app_id' => null]);
    $this->get('/admin/news/manual/create')->assertInertia(fn (Assert $page) => $page
        ->where('metaAuth.facebookAppId', null)->where('metaAuth.instagramConfigured', false)
        ->missing('metaAuth.facebookAppSecret')->missing('metaAuth.instagramAppSecret'));
    $this->get('/admin/social/facebook/connect')->assertStatus(503);
    $this->get('/admin/social/instagram/connect')->assertStatus(503);
    Http::assertNothingSent();
});

test('facebook validates the app and asks the user to choose a page before connecting', function () {
    Http::fake([
        '*debug_token*' => Http::response(['data' => ['is_valid' => true, 'app_id' => 'test-app', 'type' => 'PAGE', 'profile_id' => '123', 'expires_at' => 0, 'scopes' => ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']]]),
        '*oauth/access_token*' => Http::response(['access_token' => 'long-user-token', 'expires_in' => 5000]),
        '*me/accounts*' => Http::response(['data' => [
            ['id' => '123', 'name' => 'Halaman Desa', 'access_token' => 'private-page-token', 'tasks' => ['CREATE_CONTENT']],
            ['id' => '456', 'name' => 'No posting permission', 'access_token' => 'other-token', 'tasks' => ['ANALYZE']],
        ]]),
    ]);
    $response = $this->get('/admin/social/facebook/connect');
    parse_str(parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);
    $this->get('/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'code' => 'server-code']))->assertRedirect('/settings/integration');
    $ticket = session('meta_selection');
    $this->get('/settings/integration')->assertInertia(fn (Assert $page) => $page
        ->has('selection.pages', 1)->where('selection.pages.0.name', 'Halaman Desa')->missing('selection.pages.0.access_token'));
    expect(SocialConnection::count())->toBe(0);
    $this->postJson('/admin/social/facebook/page', ['ticket' => $ticket, 'page_id' => '123'])
        ->assertOk()->assertJsonPath('platforms.1.status', 'connected')->assertJsonPath('platforms.1.account', 'Halaman Desa');
    $connection = SocialConnection::sole();
    expect($connection->expires_at)->toBeNull();
    expect($connection->access_token)->toBe('private-page-token')
        ->and($connection->getRawOriginal('access_token'))->not->toBe('private-page-token')
        ->and($connection->toArray())->not->toHaveKey('access_token');
    $this->postJson('/admin/social/facebook/page', ['ticket' => $ticket, 'page_id' => '123'])->assertUnprocessable();
});

test('facebook rejects tokens for a different app', function () {
    Http::fake(['*debug_token*' => Http::response(['data' => ['is_valid' => true, 'app_id' => 'another-app']])]);
    Http::fake(['*oauth/access_token*' => Http::response(['access_token' => 'untrusted-token']), '*debug_token*' => Http::response(['data' => ['is_valid' => true, 'app_id' => 'another-app']])]);
    $response = $this->get('/admin/social/facebook/connect');
    parse_str(parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);
    $this->get('/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'code' => 'server-code']))->assertRedirect('/settings/integration');
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
    expect(parse_url($location, PHP_URL_HOST))->toBe('www.facebook.com');
    expect($query['scope'])->toBe('pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish');
    expect($query['client_id'])->toBe('test-app')->and($query['redirect_uri'])->toBe('http://localhost:8000/admin/social/facebook/callback');
    expect(Cache::get('meta-oauth:'.hash('sha256', session()->getId().':'.auth()->id()))['platform'])->toBe('instagram');
    $this->get('/admin/social/facebook/callback?state=forged&code=unused')->assertStatus(419);
    Http::assertNothingSent();
});

function fakeInstagramMetaPages(array $pages = [], ?array $scopes = null): void
{
    Http::fake([
        '*debug_token*' => Http::response(['data' => ['is_valid' => true, 'app_id' => 'test-app', 'type' => 'PAGE', 'profile_id' => '456', 'expires_at' => 0,
            'scopes' => $scopes ?? ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish']]]),
        '*oauth/access_token*' => Http::response(['access_token' => 'meta-user-secret', 'expires_in' => 5000]),
        '*me/accounts*' => Http::response(['data' => $pages]),
    ]);
}

function linkedInstagramPage(): array
{
    return ['id' => '456', 'name' => 'Linked Page', 'access_token' => 'instagram-page-secret',
        'tasks' => ['CREATE_CONTENT'], 'instagram_business_account' => ['id' => '789', 'username' => 'desa']];
}

test('empty OAuth discovery ignores all legacy credentials and saved accounts', function ($platform, $existing) {
    config(['services.facebook.page_id' => '456', 'services.facebook.page_access_token' => 'legacy-fb',
        'services.instagram.user_id' => '789', 'services.instagram.access_token' => 'legacy-ig']);
    if ($existing) {
        existingMetaConnection('facebook');
        existingMetaConnection('instagram');
    }
    $before = SocialConnection::all()->map(fn ($row) => $row->getRawOriginal())->all();
    Http::fake([
        '*debug_token*' => Http::response(['data' => ['is_valid' => true, 'app_id' => 'test-app',
            'scopes' => ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish']]]),
        '*oauth/access_token*' => Http::response(['access_token' => 'current-user-token']),
        '*me/accounts*' => Http::response(['data' => []]),
    ]);
    $query = startMetaFlow($this, $platform);
    $this->get('/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'code' => 'code']))
        ->assertRedirect()->assertSessionHas('connection_message', 'Tidak ada Halaman Facebook yang tersedia untuk akun ini. Koneksi sebelumnya tidak berubah.');
    expect(session('meta_selection'))->toBeNull()
        ->and(SocialConnection::all()->map(fn ($row) => $row->getRawOriginal())->all())->toBe($before);
    Http::assertSentCount(4);
    Http::assertNotSent(fn ($request) => str_contains($request->url(), '/456') || str_contains($request->url(), '/123')
        || str_contains(json_encode($request->data()), 'legacy-'));
})->with(['facebook', 'instagram'])->with([false, true]);

test('normal discovery does not query the fallback page', function () {
    config(['services.facebook.page_id' => '999']);
    fakeInstagramMetaPages([linkedInstagramPage()]);
    expect(app(MetaConnections::class)->facebookPages('short-token', 'instagram'))->toHaveCount(1);
    Http::assertNotSent(fn ($request) => str_contains($request->url(), '/999'));
});

test('a nonempty but filtered list does not trigger direct fallback', function () {
    config(['services.facebook.page_id' => '999']);
    fakeInstagramMetaPages([array_replace(linkedInstagramPage(), ['tasks' => ['ANALYZE']])]);
    expect(app(MetaConnections::class)->facebookPages('short-token', 'instagram'))->toBe([]);
    Http::assertNotSent(fn ($request) => str_contains($request->url(), '/999'));
});

test('instagram callback offers linked accounts and saves only Instagram after explicit selection', function () {
    $facebook = existingMetaConnection('facebook');
    $instagram = existingMetaConnection('instagram');
    fakeInstagramMetaPages([
        linkedInstagramPage(),
        ['id' => '999', 'name' => 'Not linked', 'access_token' => 'not-linked-secret', 'tasks' => ['CREATE_CONTENT']],
        ['id' => '998', 'name' => 'Read only', 'access_token' => 'read-only-secret', 'tasks' => ['ANALYZE'], 'instagram_business_account' => ['id' => '888', 'username' => 'read_only']],
    ]);
    $query = startMetaFlow($this, 'instagram');
    $callback = '/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'code' => 'authorization-code', 'platform' => 'facebook']);
    $response = $this->get($callback)->assertRedirect('/settings/integration');
    expect($response->getContent())->not->toContain('instagram-page-secret', 'meta-user-secret');
    expect($instagram->fresh()->access_token)->toBe('original-secret');
    $ticket = session('meta_selection');
    $this->get('/settings/integration')->assertInertia(fn (Assert $page) => $page
        ->where('selection.platform', 'instagram')->has('selection.pages', 1)
        ->where('selection.pages.0.account_name', '@desa')->missing('selection.pages.0.access_token'));
    $this->postJson('/admin/social/meta/account', ['ticket' => $ticket, 'page_id' => '999'])->assertUnprocessable();
    $result = $this->postJson('/admin/social/meta/account', ['ticket' => $ticket, 'page_id' => '456', 'platform' => 'facebook'])
        ->assertOk()->assertJsonPath('platforms.2.account', '@desa');
    expect($result->getContent())->not->toContain('instagram-page-secret', 'meta-user-secret');
    expect($instagram->fresh()->account_id)->toBe('789')->and($instagram->fresh()->auth_source)->toBe('facebook_login')
        ->and($instagram->fresh()->access_token)->toBe('instagram-page-secret')
        ->and($instagram->fresh()->getRawOriginal('access_token'))->not->toBe('instagram-page-secret');
    expect($facebook->fresh()->account_id)->toBe('123')->and($facebook->fresh()->access_token)->toBe('original-secret');
    $this->get($callback)->assertStatus(419);
    $this->postJson('/admin/social/meta/account', ['ticket' => $ticket, 'page_id' => '456'])->assertUnprocessable();
    Http::assertSent(fn ($r) => str_contains($r->url(), '/me/accounts') && str_contains($r['fields'], 'instagram_business_account'));
    Http::assertNotSent(fn ($r) => str_contains($r->url(), 'graph.instagram.com') || str_contains($r->url(), 'api.instagram.com'));
});

test('cancelled instagram consent leaves the account disconnected', function () {
    $response = $this->get('/admin/social/instagram/connect');
    parse_str(parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);
    $this->get('/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'error' => 'access_denied']))->assertRedirect('/settings/integration');
    expect(SocialConnection::count())->toBe(0);
    Http::assertNothingSent();
});

test('connection records belong to the signed in author', function () {
    $other = User::factory()->create();
    SocialConnection::create(['user_id' => $other->getKey(), 'platform' => 'instagram', 'account_id' => '987', 'account_name' => '@other', 'access_token' => 'other-secret']);
    $this->getJson('/admin/social/connections')->assertOk()->assertJsonPath('platforms.2.status', 'disconnected');
    Http::assertNothingSent();
});

function startMetaFlow($test, string $platform): array
{
    $response = $test->get('/admin/social/'.$platform.'/connect')->assertRedirect();
    parse_str(parse_url($response->headers->get('Location'), PHP_URL_QUERY), $query);

    return $query;
}

function existingMetaConnection(string $platform): SocialConnection
{
    return SocialConnection::create(['user_id' => auth()->id(), 'platform' => $platform,
        'account_id' => '123', 'account_name' => 'Original account', 'access_token' => 'original-secret']);
}

test('only admin and moderator may manage integrations', function (string $role, int $status) {
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => $role])->getKey()]));
    $this->get('/settings/integration')->assertStatus($status);
    if ($status === 302) {
        $this->get('/admin/social/facebook/connect')->assertRedirect('/');
        $this->postJson('/admin/social/instagram/disconnect', ['confirmed' => true])->assertRedirect('/');
    }
})->with([['admin', 200], ['moderator', 200], ['villager', 302]]);

test('facebook code flow requests only publishing scopes and rejects forged expired and replayed state', function () {
    $query = startMetaFlow($this, 'facebook');
    expect($query['scope'])->toBe('pages_show_list,pages_read_engagement,pages_manage_posts')
        ->and($query['response_type'])->toBe('code')
        ->and($query)->not->toHaveKey('enable_fb_login');
    $this->get('/admin/social/facebook/callback?state=forged&code=unused')->assertStatus(419);
    $query = startMetaFlow($this, 'facebook');
    $this->travel(11)->minutes();
    $this->get('/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'code' => 'unused']))->assertStatus(419);
    $this->travelBack();
    $query = startMetaFlow($this, 'facebook');
    $url = '/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'error' => 'access_denied']);
    $this->get($url)->assertRedirect('/settings/integration');
    $this->get($url)->assertStatus(419);
    Http::assertNothingSent();
});

test('cancelled or failed switching preserves the prior credentials', function (string $platform, bool $cancelled) {
    $connection = existingMetaConnection($platform);
    Http::fake(['*' => Http::response(['error' => ['message' => 'unsafe original-secret']], 400)]);
    $query = startMetaFlow($this, $platform);
    $result = $this->get('/admin/social/facebook/callback?'.http_build_query([
        'state' => $query['state'], ...($cancelled ? ['error' => 'access_denied'] : ['code' => 'new-code']),
    ]))->assertRedirect('/settings/integration');
    expect($connection->fresh()->access_token)->toBe('original-secret');
    expect($result->getContent())->not->toContain('original-secret', 'unsafe');
})->with([['facebook', true], ['facebook', false], ['instagram', true], ['instagram', false]]);

test('disconnect requires confirmation removes credentials and overrides environment fallback', function (string $platform) {
    $connection = existingMetaConnection($platform);
    config(['services.facebook.page_id' => '999', 'services.facebook.page_access_token' => 'legacy-fb',
        'services.instagram.user_id' => '999', 'services.instagram.access_token' => 'legacy-ig']);
    $this->postJson('/admin/social/'.$platform.'/disconnect')->assertUnprocessable();
    expect($connection->fresh()->isConnected())->toBeTrue();
    $this->postJson('/admin/social/'.$platform.'/disconnect', ['confirmed' => true])->assertOk();
    expect($connection->fresh()->access_token)->toBe('')->and($connection->fresh()->isConnected())->toBeFalse();
    $credentials = app(MetaCredentials::class)->forPlatform($platform);
    expect($credentials['token'])->toBeNull()->and($credentials['status'])->toBe('disconnected');
    $this->getJson('/admin/social/connections')->assertJsonPath('platforms.'.($platform === 'facebook' ? 1 : 2).'.status', 'disconnected');
    $this->postJson('/admin/news/manual', ['headline' => 'News', 'content' => '<p>Content about village activities today.</p>',
        'content_format' => 'html', 'intent' => 'publish', 'platforms' => [$platform]])->assertUnprocessable()->assertJsonValidationErrors('platforms');
    Http::assertNothingSent();
})->with(['facebook', 'instagram']);

test('disconnect also deactivates an environment-only connection', function () {
    config(['services.facebook.page_id' => '999', 'services.facebook.page_access_token' => 'legacy-fb']);
    $this->postJson('/admin/social/facebook/disconnect', ['confirmed' => true])->assertOk()->assertJsonPath('platforms.1.status', 'disconnected');
    expect(app(FacebookPublishingService::class)->configured())->toBeFalse();
});

test('facebook switching waits for valid page selection handles pagination and uses selected credentials for publishing', function () {
    $connection = existingMetaConnection('facebook');
    Http::fake([
        '*debug_token*' => Http::response(['data' => ['is_valid' => true, 'app_id' => 'test-app', 'type' => 'PAGE', 'profile_id' => '456', 'expires_at' => 0, 'scopes' => ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']]]),
        '*oauth/access_token*' => Http::response(['access_token' => 'long-user-token', 'expires_in' => 5000]),
        '*me/accounts*' => Http::sequence()
            ->push(['data' => [['id' => '456', 'name' => 'New Page', 'access_token' => 'new-page-secret', 'tasks' => ['CREATE_CONTENT']]], 'paging' => ['next' => 'https://untrusted.invalid/?access_token=secret', 'cursors' => ['after' => 'next-cursor']]])
            ->push(['data' => [['id' => '789', 'name' => 'Second Page', 'access_token' => 'second-secret', 'tasks' => ['MANAGE']]]]),
        '*/456/feed' => Http::response(['id' => '456_123']),
    ]);
    $query = startMetaFlow($this, 'facebook');
    $this->get('/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'code' => 'code']))->assertRedirect();
    $ticket = session('meta_selection');
    expect($connection->fresh()->access_token)->toBe('original-secret');
    $this->get('/settings/integration')->assertInertia(fn (Assert $page) => $page->has('selection.pages', 2));
    $this->postJson('/admin/social/facebook/page', ['ticket' => $ticket, 'page_id' => 'unavailable'])->assertUnprocessable();
    expect($connection->fresh()->access_token)->toBe('original-secret');
    $this->postJson('/admin/social/facebook/page', ['ticket' => $ticket, 'page_id' => '456'])->assertOk();
    expect($connection->fresh()->access_token)->toBe('new-page-secret');
    app(FacebookPublishingService::class)->publish(null, 'Selected page');
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/456/feed') && $request['access_token'] === 'new-page-secret');
    Http::assertSent(fn ($request) => str_contains($request->url(), '/me/accounts') && ($request['after'] ?? null) === 'next-cursor');
});

test('pending page selection is cancelled by disconnect', function () {
    $ticket = str_repeat('a', 48);
    $key = 'meta-accounts:'.auth()->id().':'.$ticket;
    Cache::put($key, Crypt::encryptString(json_encode([
        ['id' => '456', 'name' => 'New', 'access_token' => 'pending-secret', 'expires_at' => now()->addHour()->toDateTimeString()],
    ])), 600);
    $this->withSession(['meta_selection' => $ticket]);
    $this->postJson('/admin/social/facebook/disconnect', ['confirmed' => true])->assertOk();
    $this->postJson('/admin/social/facebook/page', ['ticket' => $ticket, 'page_id' => '456'])->assertUnprocessable();
    expect(Cache::has($key))->toBeFalse();
});

test('page tickets cannot be used by another user or after expiry', function () {
    $owner = auth()->user();
    $ticket = str_repeat('b', 48);
    $key = 'meta-accounts:'.$owner->getKey().':'.$ticket;
    Cache::put($key, Crypt::encryptString(json_encode([
        ['id' => '456', 'name' => 'New', 'access_token' => 'pending-secret', 'expires_at' => now()->addHour()->toDateTimeString()],
    ])), now()->addMinutes(10));
    $this->withSession(['meta_selection' => $ticket]);
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    $this->postJson('/admin/social/facebook/page', ['ticket' => $ticket, 'page_id' => '456'])->assertUnprocessable();
    $this->actingAs($owner);
    $this->travel(11)->minutes();
    $this->postJson('/admin/social/facebook/page', ['ticket' => $ticket, 'page_id' => '456'])->assertUnprocessable();
    expect(SocialConnection::count())->toBe(0);
});

test('cancelling page selection preserves the current account and removes the pending token', function () {
    $connection = existingMetaConnection('facebook');
    $ticket = str_repeat('c', 48);
    $key = 'meta-accounts:'.auth()->id().':'.$ticket;
    Cache::put($key, Crypt::encryptString('[]'), 600);
    $this->withSession(['meta_selection' => $ticket]);
    $this->postJson('/admin/social/facebook/cancel')->assertOk();
    expect(Cache::has($key))->toBeFalse()->and($connection->fresh()->access_token)->toBe('original-secret');
});

test('a stale status probe cannot invalidate a newly reconnected account', function () {
    $connection = existingMetaConnection('facebook');
    Http::fake(function () use ($connection) {
        $connection->update(['access_token' => 'replacement-secret', 'account_id' => '456']);

        return Http::response(['error' => ['code' => 190]], 400);
    });
    $this->getJson('/admin/social/connections')->assertOk()->assertJsonPath('platforms.1.status', 'connected');
    expect($connection->fresh()->isConnected())->toBeTrue()->and($connection->fresh()->access_token)->toBe('replacement-secret');
});

test('business login uses platform specific configuration IDs', function (string $platform, string $configId) {
    config(['meta.login_config_ids.facebook' => '111', 'meta.login_config_ids.instagram' => '222']);
    $query = startMetaFlow($this, $platform);
    expect($query['config_id'])->toBe($configId)->and($query)->not->toHaveKey('scope');
    expect($query['redirect_uri'])->toBe('http://localhost:8000/admin/social/facebook/callback');
})->with([['facebook', '111'], ['instagram', '222']]);

test('both connect buttons require only shared Meta app credentials', function () {
    config(['meta.instagram' => null, 'services.facebook.page_id' => null, 'services.facebook.page_access_token' => null,
        'services.instagram.user_id' => null, 'services.instagram.access_token' => null]);
    $this->get('/settings/integration')->assertInertia(fn (Assert $page) => $page
        ->where('platforms.0.connect_url', route('admin.social.facebook.start'))
        ->where('platforms.1.connect_url', route('admin.social.instagram.start')));
    startMetaFlow($this, 'instagram');
    Http::assertNothingSent();
});

test('missing Instagram permissions or linked accounts preserves the existing connection', function (bool $missingPermission) {
    $connection = existingMetaConnection('instagram');
    fakeInstagramMetaPages($missingPermission ? [linkedInstagramPage()] : [],
        $missingPermission ? ['pages_show_list', 'pages_read_engagement', 'instagram_basic'] : null);
    $query = startMetaFlow($this, 'instagram');
    $this->get('/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'code' => 'code']))->assertRedirect();
    expect(session('meta_selection'))->toBeNull()->and($connection->fresh()->access_token)->toBe('original-secret');
})->with([true, false]);

test('Instagram disconnect invalidates pending Meta authorization and account selection', function () {
    $connection = existingMetaConnection('instagram');
    fakeInstagramMetaPages([linkedInstagramPage()]);
    $query = startMetaFlow($this, 'instagram');
    $this->get('/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'code' => 'code']))->assertRedirect();
    $ticket = session('meta_selection');
    $this->postJson('/admin/social/instagram/disconnect', ['confirmed' => true])->assertOk();
    $this->postJson('/admin/social/meta/account', ['ticket' => $ticket, 'page_id' => '456'])->assertUnprocessable();
    expect($connection->fresh()->isConnected())->toBeFalse();
    $query = startMetaFlow($this, 'instagram');
    $this->postJson('/admin/social/instagram/disconnect', ['confirmed' => true])->assertOk();
    $this->get('/admin/social/facebook/callback?'.http_build_query(['state' => $query['state'], 'code' => 'code']))->assertStatus(419);
});

test('status probes use the authentication source and redact tokens', function (?string $source, string $host) {
    SocialConnection::create(['user_id' => auth()->id(), 'platform' => 'instagram', 'account_id' => '789',
        'account_name' => '@desa', 'access_token' => 'private-secret', 'auth_source' => $source]);
    Http::fake(['*' => Http::response(['id' => '789'])]);
    $response = $this->getJson('/admin/social/connections')->assertOk()->assertJsonPath('platforms.2.status', 'connected');
    expect($response->getContent())->not->toContain('private-secret');
    Http::assertSent(fn ($r) => str_starts_with($r->url(), 'https://'.$host.'/'));
})->with([[null, 'graph.instagram.com'], ['instagram_login', 'graph.instagram.com'], ['facebook_login', 'graph.facebook.com']]);

test('old direct Instagram callbacks ask to reconnect without replacing stored tokens', function () {
    $connection = existingMetaConnection('instagram');
    $this->get('/admin/social/instagram/callback?state=old&code=old')->assertRedirect('/settings/integration');
    expect($connection->fresh()->access_token)->toBe('original-secret');
    Http::assertNothingSent();
});

test('auth source migration preserves existing IDs encrypted tokens and timestamps', function () {
    $migration = require database_path('migrations/2026_09_27_180000_add_auth_source_to_social_connections.php');
    $migration->down();
    $instagram = existingMetaConnection('instagram');
    $facebook = existingMetaConnection('facebook');
    $rawToken = $instagram->getRawOriginal('access_token');
    $updatedAt = $instagram->updated_at->toDateTimeString();
    $migration->up();
    expect($instagram->fresh()->auth_source)->toBe('instagram_login')
        ->and($facebook->fresh()->auth_source)->toBe('facebook_login')
        ->and($instagram->fresh()->account_id)->toBe('123')
        ->and($instagram->fresh()->getRawOriginal('access_token'))->toBe($rawToken)
        ->and($instagram->fresh()->updated_at->toDateTimeString())->toBe($updatedAt);
});

test('Instagram discovery diagnostics log only safe fields before filtering', function () {
    config(['meta.instagram_discovery_diagnostics' => true]);
    $records = [];
    Log::shouldReceive('channel')->with('single')->andReturnSelf();
    Log::shouldReceive('info')->andReturnUsing(function ($event, $context) use (&$records) {
        $records[] = ['event' => $event, 'context' => $context];
    });
    fakeInstagramMetaPages([
        linkedInstagramPage(),
        ['id' => '999', 'name' => 'No link', 'tasks' => ['ANALYZE'], 'access_token' => 'rejected-secret'],
        ['id' => '998', 'name' => 'meta-user-secret test-secret short-secret', 'tasks' => ['MANAGE'], 'access_token' => 'hidden-secret',
            'instagram_business_account' => ['id' => '888']],
    ]);
    $pages = app(MetaConnections::class)->facebookPages('short-secret', 'instagram');
    expect($pages)->toHaveCount(1);
    $records = array_values(array_filter($records, fn ($record) => in_array($record['event'], ['meta.instagram.discovery.page', 'meta.instagram.discovery.summary'])));
    expect($records)->toHaveCount(4);
    expect($records[0]['context'])->toBe([
        'page_id' => '456', 'page_name' => 'Linked Page', 'tasks' => ['CREATE_CONTENT'],
        'has_page_token' => true, 'has_instagram_business_account' => true,
        'instagram_business_account_id' => '789', 'instagram_username' => 'desa',
        'passes_task_filter' => true, 'passes_instagram_filter' => true,
    ]);
    expect($records[1]['context']['passes_task_filter'])->toBeFalse()
        ->and($records[1]['context']['passes_instagram_filter'])->toBeFalse()
        ->and($records[2]['context']['passes_task_filter'])->toBeTrue()
        ->and($records[2]['context']['passes_instagram_filter'])->toBeFalse()
        ->and($records[3])->toBe(['event' => 'meta.instagram.discovery.summary', 'context' => ['zero_pages' => false, 'accounts_count' => 3, 'has_page_ids' => true]]);
    expect(json_encode($records))->not->toContain('instagram-page-secret', 'rejected-secret', 'hidden-secret', 'meta-user-secret', 'test-secret', 'short-secret');
});

test('Instagram discovery diagnoses an empty response without logging tokens', function () {
    config(['meta.instagram_discovery_diagnostics' => true]);
    Log::shouldReceive('channel')->with('single')->andReturnSelf();
    Log::shouldReceive('info')->with('meta.instagram.discovery.user', Mockery::any());
    Log::shouldReceive('info')->with('meta.instagram.discovery.permissions', Mockery::any());
    Log::shouldReceive('info')->with('meta.instagram.discovery.summary', ['zero_pages' => true, 'accounts_count' => 0, 'has_page_ids' => false])->once();
    fakeInstagramMetaPages([]);
    expect(app(MetaConnections::class)->facebookPages('short-secret', 'instagram'))->toBe([]);
});

test('Instagram discovery diagnostics can be disabled', function () {
    config(['meta.instagram_discovery_diagnostics' => false]);
    Log::shouldReceive('channel')->never();
    fakeInstagramMetaPages([linkedInstagramPage()]);
    expect(app(MetaConnections::class)->facebookPages('short-secret', 'instagram'))->toHaveCount(1);
});

test('OAuth identity diagnostics allowlist user and permissions without changing account discovery', function () {
    config(['meta.instagram_discovery_diagnostics' => true]);
    $records = [];
    Log::shouldReceive('channel')->with('single')->andReturnSelf();
    Log::shouldReceive('info')->andReturnUsing(function ($event, $context) use (&$records) {
        $records[$event] = $context;
    });
    fakeInstagramMetaPages([]);
    Http::fake([
        '*/me?*' => Http::response(['id' => '123', 'name' => 'Example meta-user-secret', 'access_token' => 'do-not-log', 'email' => 'private@example.com']),
        '*/me/permissions*' => Http::response(['data' => [
            ['permission' => 'pages_show_list', 'status' => 'granted', 'access_token' => 'do-not-log'],
            ['permission' => 'pages_read_engagement', 'status' => 'declined'],
            ['permission' => 'instagram_basic', 'status' => 'granted'],
            ['permission' => 'instagram_content_publish', 'status' => 'expired'],
        ]]),
    ]);
    expect(app(MetaConnections::class)->facebookPages('short-secret', 'instagram'))->toBe([]);
    expect($records['meta.instagram.discovery.user'])->toBe(['available' => true, 'id' => '123', 'name' => 'Example [REDACTED]']);
    expect($records['meta.instagram.discovery.permissions']['granted'])->toBe([
        'pages_show_list' => true, 'pages_read_engagement' => false, 'instagram_basic' => true, 'instagram_content_publish' => false,
    ]);
    expect(json_encode($records))->not->toContain('meta-user-secret', 'short-secret', 'do-not-log', 'private@example.com');
    Http::assertSent(fn ($r) => str_contains($r->url(), '/me/permissions') && $r->hasHeader('Authorization', 'Bearer meta-user-secret'));
});

test('pending authorization survives an unrelated session payload overwrite', function () {
    $query = startMetaFlow($this, 'facebook');
    // A background response may save a session snapshot taken before connect.
    session()->forget('meta_oauth');
    $url = '/admin/social/facebook/callback?'.http_build_query([
        'state' => $query['state'], 'error' => 'access_denied',
    ]);
    $this->get($url)->assertRedirect('/settings/integration');
    $this->get($url)->assertStatus(419);
    Http::assertNothingSent();
});

test('pending authorization cannot be used by another signed in user', function () {
    $query = startMetaFlow($this, 'facebook');
    $this->actingAs(User::factory()->create([
        'roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey(),
    ]));
    $this->get('/admin/social/facebook/callback?'.http_build_query([
        'state' => $query['state'], 'code' => 'unused',
    ]))->assertStatus(419);
    Http::assertNothingSent();
});

test('pending authorization cannot be used from another browser session', function () {
    $query = startMetaFlow($this, 'facebook');
    $this->withCookie(config('session.cookie'), Illuminate\Support\Str::random(40));
    $this->get('/admin/social/facebook/callback?'.http_build_query([
        'state' => $query['state'], 'code' => 'unused',
    ]))->assertStatus(419);
    Http::assertNothingSent();
});

test('authorization starts on the configured callback host before creating state', function () {
    $this->get('http://127.0.0.1:8000/admin/social/facebook/connect?insights=1')
        ->assertRedirect('http://localhost:8000/admin/social/facebook/connect?insights=1');
    expect(Cache::has('meta-oauth:'.hash('sha256', session()->getId().':'.auth()->id())))->toBeFalse();
    Http::assertNothingSent();
});
