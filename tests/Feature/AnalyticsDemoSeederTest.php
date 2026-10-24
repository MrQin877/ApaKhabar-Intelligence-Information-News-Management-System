<?php

use App\Models\Broadcast;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Analytics\AnalyticsReport;
use Carbon\Carbon;
use Database\Seeders\AnalyticsDemoSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

it('creates coherent presentation data once without changing existing data or sending anything', function () {
    $this->travelTo(Carbon::parse('2026-10-22 03:00:00', 'UTC'));
    Http::preventStrayRequests();
    Notification::fake();
    Queue::fake();
    foreach (['admin', 'moderator'] as $role) {
        User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => $role])->getKey()]);
    }
    $original = News::factory()->create(['title' => 'Berita asli', 'view' => 7]);
    $snapshot = DB::table('news')->where('postID', $original->getKey())->first();
    app(AnalyticsDemoSeeder::class)->run();
    expect(User::where('name', 'like', '[Demo] Warga %')->count())->toBe(144);
    expect(News::where('title', 'like', AnalyticsDemoSeeder::PREFIX.'%')->count())->toBe(16);
    expect(Broadcast::where('title', 'like', AnalyticsDemoSeeder::PREFIX.'%')->count())->toBe(9);
    expect(DB::table('news')->where('postID', $original->getKey())->first())->toEqual($snapshot);
    foreach (News::where('title', 'like', AnalyticsDemoSeeder::PREFIX.'%')->get() as $post) {
        expect((int) $post->unique_views)->toBe(DB::table('news_viewers')->where('news_id', $post->getKey())->count());
        expect((int) $post->likes_count)->toBe(DB::table('likes')->where('postID', $post->getKey())->count());
        expect((int) $post->view)->toBeGreaterThanOrEqual((int) $post->unique_views);
    }
    expect(DB::table('villager_activity_hours')->count())->toBeGreaterThan(1000);
    expect(DB::table('villager_activity_hours')->where('hour', '>', now('UTC'))->count())->toBe(0);
    expect(DB::table('notifications')->where('notifiable_id', '<=', 2)->count())->toBe(0);
    expect(DB::table('notifications')->whereNotNull('read_at')->count())->toBeGreaterThan(0);
    $report = app(AnalyticsReport::class)->build(['overview', 'activity', 'broadcast'], '2026-09-23', '2026-10-22');
    expect($report[0]['rows'][1]['value'])->toBeGreaterThan($report[0]['registration_previous']);
    expect($report[0]['rows'][2]['value'])->toBeGreaterThan(0);
    expect(collect($report[1]['heatmap'])->max('value'))->toBeGreaterThan(0);
    expect($report[2]['rows'][0]['value'])->toBe(9);
    $tables = ['users', 'emails', 'news', 'likes', 'comments', 'news_viewers', 'notifications', 'broadcasts', 'villager_activity_hours', 'intelligent_news_drafts', 'comment_moderation_history'];
    $before = collect($tables)->mapWithKeys(fn ($t) => [$t => DB::table($t)->count()])->all();
    app(AnalyticsDemoSeeder::class)->run();
    expect(collect($tables)->mapWithKeys(fn ($t) => [$t => DB::table($t)->count()])->all())->toBe($before);
    Notification::assertNothingSent();
    Queue::assertNothingPushed();
    Http::assertNothingSent();
});

it('refuses to seed presentation data outside local or testing environments', function () {
    $environment = app()['env'];
    app()['env'] = 'production';
    try {
        expect(fn () => app(AnalyticsDemoSeeder::class)->run())->toThrow(RuntimeException::class);
    } finally {
        app()['env'] = $environment;
    }
});
