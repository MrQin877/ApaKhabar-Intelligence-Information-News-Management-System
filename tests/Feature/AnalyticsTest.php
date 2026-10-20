<?php

use App\Models\AnalyticsSetting;
use App\Models\Broadcast;
use App\Models\News;
use App\Models\SocialConnection;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Analytics\AnalyticsReport;
use App\Services\Analytics\MetaInsights;
use App\Services\Analytics\SectionLayout;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

function analyticsUser(string $role = 'admin'): User
{
    return User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => $role])->getKey()]);
}

test('only admins can read and configure analytics', function () {
    $moderator = analyticsUser('moderator');
    $this->actingAs($moderator)->get('/admin/analytics')->assertForbidden();
    $this->put('/admin/analytics/dashboard', ['widgets' => ['age'], 'period_days' => 30])->assertForbidden();
    $this->put('/admin/analytics/meta', ['connection_ids' => []])->assertForbidden();
    $this->post('/admin/analytics/meta/sync')->assertForbidden();
    $this->actingAs(analyticsUser('villager'))->get('/admin/analytics')->assertRedirect('/');
    $this->actingAs(analyticsUser())->get('/admin/analytics')->assertOk()->assertInertia(fn (Assert $page) => $page->component('admin/analytics')->has('widgets', 9));
});
test('moderator responses contain only approved widgets and revocation is immediate', function () {
    AnalyticsSetting::current()->update(['widgets' => ['categories']]);
    $moderator = analyticsUser('moderator');
    $this->actingAs($moderator)->get('/admin/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page->has('widgets', 1)->where('widgets.0.id', 'categories')->missing('configuration')->missing('connections'));
    $this->get('/admin/broadcasting')->assertOk()->assertInertia(fn (Assert $page) => $page->where('analytics', null));
    $admin = analyticsUser();
    $this->actingAs($admin)->put('/admin/analytics/dashboard', ['widgets' => [], 'period_days' => 7])->assertRedirect();
    $this->assertDatabaseHas('analytics_setting_changes', ['user_id' => $admin->getKey()]);
    $this->actingAs($moderator)->get('/admin/dashboard')->assertInertia(fn (Assert $page) => $page->has('widgets', 0));
});
test('widget configuration rejects unknown and duplicate keys', function () {
    $this->actingAs(analyticsUser())->put('/admin/analytics/dashboard', ['widgets' => ['secrets'], 'period_days' => 30])->assertSessionHasErrors('widgets.0');
    $this->put('/admin/analytics/dashboard', ['widgets' => ['age', 'age'], 'period_days' => 30])->assertSessionHasErrors('widgets.0');
});
test('admin can customize widget layout order, column span, and chart height', function () {
    $admin = analyticsUser();
    $this->actingAs($admin)->put('/admin/analytics/dashboard', [
        'widgets' => ['age', 'broadcast'],
        'period_days' => 14,
        'layout' => [
            'order' => ['overview', 'broadcast', 'age', 'categories', 'activity', 'citizenship', 'ethnicity', 'meta', 'engagement'],
            'sizes' => [
                'broadcast' => ['span' => 2, 'height' => 'lg'],
                'age' => ['span' => 1, 'height' => 'sm'],
            ],
        ],
    ])->assertRedirect();

    $this->actingAs($admin)->get('/admin/analytics')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('widgets.1.id', 'broadcast')
        ->where('widgets.1.span', 2)
        ->where('widgets.1.height', 'lg')
        ->where('widgets.2.id', 'age')
        ->where('widgets.2.span', 1)
        ->where('widgets.2.height', 'sm')
    );

    $moderator = analyticsUser('moderator');
    $this->actingAs($moderator)->get('/admin/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('widgets', 2)
        ->where('widgets.0.id', 'broadcast')
        ->where('widgets.0.span', 2)
        ->where('widgets.1.id', 'age')
        ->where('widgets.1.span', 1)
    );
});
test('demographics exclude officers and keep unknown groups and exact birthday boundaries', function () {
    $this->travelTo(Carbon::parse('2026-10-19 12:00:00', 'Asia/Jakarta'));
    analyticsUser('admin')->update(['date_of_birth' => '2000-01-01', 'citizenship' => 'wna']);
    User::factory()->create(['date_of_birth' => '2008-10-19', 'citizenship' => 'wni', 'gender' => 'male']);
    User::factory()->create(['date_of_birth' => '2008-10-20', 'citizenship' => 'wna', 'gender' => null]);
    User::factory()->create();
    $report = app(AnalyticsReport::class)->build(['age', 'citizenship'], '2026-10-01', '2026-10-19');
    $ages = collect($report[0]['rows'])->keyBy('label');
    expect($ages['18–24']['value'])->toBe(1)->and($ages['<18']['value'])->toBe(1)->and($ages['Belum mengisi']['value'])->toBe(1);
    $citizens = collect($report[1]['rows'])->keyBy('label');
    expect($citizens['WNA']['value'])->toBe(1)->and($citizens['WNA']['unspecified'])->toBe(1)->and($citizens['WNI']['percent'])->toBe(33.33);
});
test('activity is deduplicated and excludes staff and untrusted timestamps', function () {
    $this->travelTo(Carbon::parse('2026-10-19 02:30:00', 'UTC'));
    $villager = analyticsUser('villager');
    $this->actingAs($villager)->postJson('/activity', ['event' => 'post_open', 'timestamp' => '2000-01-01', 'platform' => 'mobile'])->assertNoContent();
    $this->postJson('/activity', ['event' => 'feed_open'])->assertNoContent();
    $this->assertDatabaseCount('villager_activity_hours', 1);
    $token = $villager->createToken('mobile')->plainTextToken;
    $this->withHeader('Authorization', 'Bearer '.$token)->postJson('/api/activity', ['event' => 'feed_open'])->assertNoContent();
    $report = app(AnalyticsReport::class)->build(['activity'], '2026-10-19', '2026-10-19');
    expect($report[0]['rows'][0]['value'])->toBe(1);
    expect(collect($report[0]['heatmap'])->first(fn ($c) => $c['day'] === 1 && $c['hour'] === 9)['value'])->toBe(1);
    $this->actingAs(analyticsUser())->postJson('/activity', ['event' => 'post_open'])->assertRedirect('/admin/dashboard');
});
test('registration requires valid demographics on both endpoints and never accepts a role', function (string $endpoint) {
    Notification::fake();
    $base = ['name' => 'Warga', 'email' => 'warga@example.com', 'password' => 'Password123!', 'password_confirmation' => 'Password123!'];
    $this->postJson($endpoint, $base)->assertUnprocessable()->assertJsonValidationErrors(['date_of_birth', 'citizenship']);
    $this->postJson($endpoint, [...$base, 'date_of_birth' => now()->addDay()->toDateString(), 'citizenship' => 'invalid'])->assertUnprocessable()->assertJsonValidationErrors(['date_of_birth', 'citizenship']);
    $response = $this->postJson($endpoint, [...$base, 'date_of_birth' => '2000-02-29', 'citizenship' => 'wni', 'roleID' => 999]);
    if ($endpoint === '/api/register') {
        $response->assertCreated();
    } else {
        $response->assertSuccessful();
    }
    $user = User::first();
    expect($user->role)->toBe('villager')->and($user->date_of_birth->format('Y-m-d'))->toBe('2000-02-29');
    expect($user->toArray())->not->toHaveKey('date_of_birth');
})->with(['/register', '/api/register']);
test('profile demographics are editable without exposing them publicly', function () {
    $user = analyticsUser('villager');
    $this->actingAs($user)->patch('/settings/profile', ['name' => $user->name, 'email' => $user->email, 'date_of_birth' => '1990-01-02', 'citizenship' => 'dual', 'gender' => 'female'])->assertRedirect();
    expect($user->fresh()->citizenship)->toBe('dual');
    $this->patch('/settings/profile', ['name' => $user->name, 'email' => $user->email, 'date_of_birth' => ''])->assertSessionHasErrors('date_of_birth');
});
test('meta sync stores provider periods idempotently and never turns a failure into zero', function () {
    $user = analyticsUser();
    $connection = SocialConnection::create(['user_id' => $user->getKey(), 'platform' => 'instagram', 'account_id' => '123', 'account_name' => 'Village', 'access_token' => 'secret', 'auth_source' => 'facebook_login']);
    AnalyticsSetting::current()->update(['meta_connection_ids' => [$connection->id]]);
    Http::fake(['*' => Http::sequence()->push(['data' => [['name' => 'reach', 'period' => 'day', 'values' => [['value' => 12, 'end_time' => '2026-10-19T00:00:00+0000']]]]])->push(['data' => [['name' => 'reach', 'period' => 'day', 'values' => [['value' => 12, 'end_time' => '2026-10-19T00:00:00+0000']]]]])->push(['error' => ['message' => 'token secret']], 403)]);
    app(MetaInsights::class)->sync();
    app(MetaInsights::class)->sync();
    $this->assertDatabaseCount('meta_insight_snapshots', 1);
    $this->assertDatabaseHas('meta_insight_snapshots', ['value' => 12]);
    app(MetaInsights::class)->sync();
    expect($connection->fresh()->insights_status)->toBe('unavailable');
    $report = app(MetaInsights::class)->report('2026-10-18', '2026-10-18');
    expect($report['accounts'][1]['rows'][0]['value'])->toBe(12);
    expect(json_encode($report))->not->toContain('secret');
    $connection->update(['account_id' => '456']);
    expect(app(MetaInsights::class)->report('2026-10-18', '2026-10-18')['accounts'][1]['rows'])->toBe([]);
});
test('admin cannot select another users meta connection', function () {
    Queue::fake();
    $owner = analyticsUser();
    $connection = SocialConnection::create(['user_id' => $owner->getKey(), 'platform' => 'facebook', 'account_id' => '123', 'account_name' => 'Other', 'access_token' => 'secret']);
    $this->actingAs(analyticsUser())->put('/admin/analytics/meta', ['connection_ids' => [$connection->id]])->assertSessionHasErrors('connection_ids.0');
});

test('broadcast detail does not leak analytics to moderators', function () {
    $admin = analyticsUser();
    $broadcast = Broadcast::create(['created_by' => $admin->getKey(), 'title' => 'Test', 'message' => 'Test message']);
    $this->actingAs(analyticsUser('moderator'))->get('/admin/broadcasting/'.$broadcast->getKey())->assertOk()->assertInertia(fn (Assert $page) => $page->where('broadcast.stats', null));
    $this->actingAs($admin)->get('/admin/broadcasting/'.$broadcast->getKey())->assertOk()->assertInertia(fn (Assert $page) => $page->has('broadcast.stats'));
});
test('csv exports are admin only and neutralize spreadsheet formulas', function () {
    User::factory()->create(['ethnicity' => '=1+1']);
    $this->actingAs(analyticsUser('moderator'))->get('/admin/analytics?export=csv')->assertForbidden();
    $response = $this->actingAs(analyticsUser())->get('/admin/analytics?export=csv');
    $response->assertOk()->assertDownload();
    expect($response->streamedContent())->toContain("'=1+1")->not->toContain('date_of_birth');
});
test('invalid report ranges return actionable validation errors', function () {
    $this->actingAs(analyticsUser())->getJson('/admin/analytics?from=2024-01-01&to=2026-01-01')->assertUnprocessable()->assertJsonValidationErrors('to');
    $this->getJson('/admin/analytics?from=2026-10-20&to=2026-10-19')->assertUnprocessable()->assertJsonValidationErrors('to');
});
test('category periods use the reporting timezone while lifetime views stay labelled', function () {
    config(['app.timezone' => 'Asia/Kuala_Lumpur', 'analytics.timezone' => 'Asia/Jakarta']);
    $inside = News::create(['title' => 'Inside', 'content' => 'Content', 'view' => 10]);
    $inside->forceFill(['created_at' => '2026-10-19 01:00:00'])->save();
    $outside = News::create(['title' => 'Outside', 'content' => 'Content', 'view' => 90]);
    $outside->forceFill(['created_at' => '2026-10-19 00:59:00'])->save();
    $report = app(AnalyticsReport::class)->build(['categories'], '2026-10-19', '2026-10-19');
    expect($report[0]['rows'][0]['value'])->toBe(1)->and($report[0]['rows'][0]['lifetime_views'])->toBe(10);
});

test('grid positions and dimensions persist independently from moderator visibility', function () {
    $this->actingAs(analyticsUser())->put('/admin/analytics/dashboard', [
        'widgets' => ['age'], 'period_days' => 30,
        'layout' => ['grid' => [
            'age' => ['x' => 0, 'y' => 0, 'w' => 4, 'h' => 5],
            'categories' => ['x' => 4, 'y' => 0, 'w' => 8, 'h' => 7],
        ]],
    ])->assertRedirect()->assertSessionHasNoErrors();
    $this->get('/admin/analytics')->assertInertia(fn (Assert $page) => $page
        ->where('configuration.layout.version', 2)
        ->where('configuration.layout.sections.0.id', 'migrated')
        ->where('configuration.layout.sections.0.widgets.1.id', 'categories')
        ->where('configuration.layout.sections.0.widgets.1.size', 'large'));
    $this->actingAs(analyticsUser('moderator'))->get('/admin/dashboard')
        ->assertInertia(fn (Assert $page) => $page->has('widgets', 1)
            ->where('widgets.0.id', 'age')->where('widgets.0.grid.w', 4));
});

test('grid rejects invalid dimensions and positions', function ($cell) {
    $this->actingAs(analyticsUser())->put('/admin/analytics/dashboard', [
        'widgets' => [], 'period_days' => 30, 'layout' => ['grid' => ['age' => $cell]],
    ])->assertSessionHasErrors();
})->with([
    [['x' => 0, 'y' => 0, 'w' => 3, 'h' => 4]],
    [['x' => 8, 'y' => 0, 'w' => 6, 'h' => 4]],
    [['x' => 0, 'y' => -1, 'w' => 6, 'h' => 4]],
    [['x' => 0, 'y' => 0, 'w' => 6, 'h' => 101]],
]);

test('section layouts persist shared across admins without changing permissions and filter moderator payload', function () {
    $layout = ['version' => 2, 'sections' => [
        ['id' => 'citizens', 'title' => 'Warga', 'order' => 0, 'columns' => 2, 'widgets' => [
            ['id' => 'age', 'size' => 'medium', 'order' => 0],
            ['id' => 'citizenship', 'size' => 'large', 'order' => 1],
        ]],
        ['id' => 'private', 'title' => 'Admin', 'order' => 1, 'columns' => 1, 'widgets' => [['id' => 'meta', 'size' => 'medium', 'order' => 0]]],
    ]];
    $this->actingAs(analyticsUser())->put('/admin/analytics/dashboard', ['widgets' => ['age'], 'period_days' => 14, 'layout' => $layout])->assertSessionHasNoErrors();
    expect(AnalyticsSetting::current()->layout)->toBe($layout);
    $this->actingAs(analyticsUser())->get('/admin/analytics')->assertInertia(fn (Assert $page) => $page->where('configuration.layout', $layout)->has('widgets', 9));
    $this->actingAs(analyticsUser('moderator'))->get('/admin/dashboard')->assertInertia(fn (Assert $page) => $page
        ->has('widgets', 1)->where('widgets.0.id', 'age')->has('layout.sections', 1)->has('layout.sections.0.widgets', 1)
        ->where('layout.sections.0.widgets.0.id', 'age')->missing('configuration')->missing('connections'));
    $this->put('/admin/analytics/dashboard', ['widgets' => ['meta'], 'period_days' => 14, 'layout' => $layout])->assertForbidden();
});

test('section validation rejects duplicates unknown identities unsupported sizes and oversized sections', function () {
    $this->actingAs(analyticsUser());
    $section = ['id' => 'one', 'title' => '', 'order' => 0, 'columns' => 1, 'widgets' => [['id' => 'age', 'size' => 'large', 'order' => 0]]];
    $payload = ['widgets' => [], 'period_days' => 30, 'layout' => ['version' => 2, 'sections' => [$section]]];
    $this->put('/admin/analytics/dashboard', $payload)->assertSessionHasErrors('layout.sections.0.widgets.0.size');
    $payload['layout']['sections'][0]['widgets'][0]['size'] = 'medium';
    $payload['layout']['sections'][] = [...$payload['layout']['sections'][0], 'id' => 'two', 'order' => 1];
    $this->put('/admin/analytics/dashboard', $payload)->assertSessionHasErrors('layout.sections.0.widgets.0.id');
    $payload['layout']['sections'] = [$section];
    $payload['layout']['sections'][0]['widgets'][0]['id'] = 'unknown';
    $this->put('/admin/analytics/dashboard', $payload)->assertSessionHasErrors('layout.sections.0.widgets.0.id');
    $payload['layout']['sections'] = [];
    $this->put('/admin/analytics/dashboard', $payload)->assertSessionHasNoErrors();
    expect(AnalyticsSetting::current()->resolvedSections()['sections'])->toBe([]);
});

test('legacy layout migration preserves identities and backs up original on first version two save', function () {
    $old = ['order' => ['broadcast', 'age'], 'grid' => ['broadcast' => ['x' => 0, 'y' => 0, 'w' => 12, 'h' => 12]]];
    AnalyticsSetting::current()->update(['layout' => $old, 'widgets' => ['age']]);
    $layout = AnalyticsSetting::current()->resolvedSections();
    expect($layout['sections'][0]['widgets'][0])->toBe(['id' => 'broadcast', 'size' => 'large', 'order' => 0]);
    expect($layout['sections'][0]['widgets'])->toHaveCount(9);
    expect(AnalyticsSetting::current()->layout)->toBe($old);
    $this->actingAs(analyticsUser())->put('/admin/analytics/dashboard', ['widgets' => ['age'], 'period_days' => 30, 'layout' => $layout])->assertSessionHasNoErrors();
    $history = DB::table('analytics_setting_changes')->get()->map(fn ($r) => json_decode($r->configuration, true));
    expect($history->firstWhere('migration_backup', true)['layout'])->toBe($old);
    expect(AnalyticsSetting::current()->widgets)->toBe(['age']);
});

test('loading version two drops unknown and duplicate widgets safely without restoring removed widgets', function () {
    $layout = SectionLayout::resolve(['version' => 2, 'sections' => [
        ['id' => 'one', 'columns' => 1, 'widgets' => [['id' => 'age', 'size' => 'large'], ['id' => 'unknown'], ['id' => 'age']]],
    ]]);
    expect($layout['sections'][0]['widgets'])->toBe([['id' => 'age', 'size' => 'medium', 'order' => 0]]);
});

test('registration comparison uses the preceding equal calendar period and excludes staff', function () {
    config(['analytics.timezone' => 'Asia/Jakarta', 'app.timezone' => 'UTC']);
    // Oct 1–7 in Jakarta: prior window is Sep 24 00:00 through Sep 30 23:59:59.
    analyticsUser('villager')->forceFill(['created_at' => '2026-09-23 17:00:00'])->save();
    analyticsUser('villager')->forceFill(['created_at' => '2026-09-30 16:59:59'])->save();
    analyticsUser('villager')->forceFill(['created_at' => '2026-09-23 16:59:59'])->save();
    analyticsUser('villager')->forceFill(['created_at' => '2026-09-30 17:00:00'])->save();
    analyticsUser('moderator')->forceFill(['created_at' => '2026-09-25 00:00:00'])->save();
    $report = app(AnalyticsReport::class)->build(['overview'], '2026-10-01', '2026-10-07')[0];
    expect($report['registration_previous'])->toBe(2)
        ->and($report['rows'][1]['value'])->toBe(1);
});
