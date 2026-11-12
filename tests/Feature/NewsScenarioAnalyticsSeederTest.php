<?php

use App\Models\News;
use Database\Seeders\NewsScenarioAnalyticsSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Notification;

it('adds consistent scenario activity once without rewriting news or contacting external services', function () {
    Http::preventStrayRequests();
    Queue::fake();
    Notification::fake();
    $post = News::factory()->create(['status' => 'active', 'title' => 'Perbaikan Jalan Melati', 'created_at' => now()->subHour(), 'view' => 0, 'unique_views' => 0]);
    $date = $post->created_at;
    app(NewsScenarioAnalyticsSeeder::class)->run();
    $post->refresh();
    expect($post->title)->toBe('Perbaikan Jalan Melati')
        ->and($post->created_at->equalTo($date))->toBeTrue()
        ->and((int) $post->unique_views)->toBe(68)
        ->and((int) $post->view)->toBeGreaterThanOrEqual(68)
        ->and((int) $post->likes_count)->toBe(19)
        ->and(DB::table('news_viewers')->count())->toBe(68)
        ->and(DB::table('likes')->count())->toBe(19)
        ->and(DB::table('comments')->count())->toBe(4)
        ->and(DB::table('comments')->where('created_at', '<', $date)->count())->toBe(0)
        ->and(DB::table('comments')->where('created_at', '>', now())->count())->toBe(0)
        ->and(DB::table('villager_activity_hours')->where('hour', '>', now('UTC'))->count())->toBe(0);
    $counts = fn () => collect(['users', 'comments', 'likes', 'villager_activity_hours'])->mapWithKeys(fn ($t) => [$t => DB::table($t)->count()])->all();
    $before = $counts();
    app(NewsScenarioAnalyticsSeeder::class)->run();
    expect($counts())->toBe($before);
    Http::assertNothingSent();
    Queue::assertNothingPushed();
    Notification::assertNothingSent();
});
