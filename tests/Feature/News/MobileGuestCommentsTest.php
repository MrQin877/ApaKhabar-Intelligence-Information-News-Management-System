<?php

use App\Models\Comment;
use App\Models\News;
use App\Models\ShortVideo;
use App\Models\ShortVideoComment;
use App\Models\User;
use App\Services\GuestCommentIdentity;
use App\Services\News\InteractionService;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

function mobileCommentHeaders($test): array
{
    return ['X-Guest-Token' => $test->postJson('/api/guest-comments/identity')->assertCreated()->json('token')];
}

function mobileCommentChallenge($test, string $kind, $id, array $headers): string
{
    $token = $test->getJson('/api/'.($kind === 'news' ? 'news' : 'shorts').'/'.$id.'/comment-context', $headers)
        ->assertOk()->json('challenge');
    $claim = json_decode(Crypt::decryptString($token), true);
    $claim['time'] -= 4;

    return Crypt::encryptString(json_encode($claim));
}

function mobileCommentVideo(): ShortVideo
{
    return ShortVideo::create([
        'created_by' => User::factory()->create()->getKey(), 'title' => 'Community update', 'description' => 'Local news',
        'video_url' => 'https://example.com/video.mp4', 'video_public_id' => 'test-short',
        'thumbnail_url' => 'https://example.com/video.jpg', 'metadata' => ['duration' => 20],
        'status' => 'published', 'published_at' => now(),
    ]);
}

beforeEach(function () {
    Http::preventStrayRequests();
    Http::fake([
        'api.openai.com/v1/moderations' => Http::response(['results' => [['flagged' => false, 'categories' => ['harassment' => false]]]]),
        'api.openai.com/v1/chat/completions' => Http::response(appropriateCommentClassification()),
    ]);
    config(['engagement.openai_key' => 'test-key']);
});

test('mobile guest quota is persistent and shared across News Shorts and replies', function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    $this->travelTo(now('Asia/Jakarta')->startOfDay()->setTime(23, 59, 50));
    $news = News::factory()->create();
    $video = mobileCommentVideo();
    $headers = mobileCommentHeaders($this);
    $newsChallenge = mobileCommentChallenge($this, 'news', $news->getKey(), $headers);
    $shortChallenge = mobileCommentChallenge($this, 'short', $video->id, $headers);
    $first = $this->postJson('/api/news/'.$news->getKey().'/comment', ['content' => 'First news comment', 'challenge' => $newsChallenge], $headers)
        ->assertCreated()->assertJsonPath('remaining_quota', 2);
    expect($first->headers->getCookies())->toBeEmpty();
    $this->postJson('/api/shorts/'.$video->id.'/comments', ['content' => 'Second short comment', 'challenge' => $shortChallenge], $headers)
        ->assertCreated()->assertJsonPath('remaining_quota', 1);
    $root = Comment::first()->getKey();
    $this->postJson('/api/comments/'.$root.'/replies', ['content' => 'Third news reply', 'challenge' => $newsChallenge], $headers)
        ->assertCreated()->assertJsonPath('remaining_quota', 0);
    $this->postJson('/api/shorts/'.$video->id.'/comments/'.ShortVideoComment::first()->id.'/replies', ['content' => 'Fourth reply', 'challenge' => $shortChallenge], $headers)
        ->assertUnprocessable()->assertJsonPath('code', 'guest_comment_quota_exceeded')->assertJsonPath('remaining_quota', 0);
    expect(Comment::count())->toBe(2)->and(ShortVideoComment::count())->toBe(1)
        ->and(Comment::first()->guest_name)->toBe(ShortVideoComment::first()->guest_name)
        ->and(DB::table('guest_comment_days')->first()->comment_count)->toBe(3);
    $this->getJson('/api/shorts/'.$video->id.'/comments')->assertOk()->assertJsonPath('count', 1);
    // No early reset at 23:59:59; the same credential is eligible exactly at Jakarta midnight.
    $this->travelTo(now('Asia/Jakarta')->setTime(23, 59, 59));
    $this->postJson('/api/news/'.$news->getKey().'/comment', ['content' => 'Still today', 'challenge' => $newsChallenge], $headers)
        ->assertUnprocessable()->assertJsonPath('code', 'guest_comment_quota_exceeded');
    $this->travelTo(now('Asia/Jakarta')->addSecond());
    $challenge = mobileCommentChallenge($this, 'short', $video->id, $headers);
    $this->postJson('/api/shorts/'.$video->id.'/comments/'.ShortVideoComment::first()->id.'/replies', ['content' => 'New day reply', 'challenge' => $challenge], $headers)
        ->assertCreated()->assertJsonPath('remaining_quota', 2);
});

test('mobile validation duplicate and failed challenge submissions never consume quota', function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    $news = News::factory()->create();
    $headers = mobileCommentHeaders($this);
    $url = '/api/news/'.$news->getKey().'/comment';
    $challenge = mobileCommentChallenge($this, 'news', $news->getKey(), $headers);
    $this->postJson($url, ['content' => ''], $headers)->assertUnprocessable();
    $this->postJson($url, ['content' => 'Missing challenge'], $headers)->assertUnprocessable();
    $this->postJson($url, ['content' => 'Spam', 'website' => 'spam', 'challenge' => $challenge], $headers)->assertUnprocessable();
    expect(DB::table('guest_comment_days')->count())->toBe(0);
    $this->postJson($url, ['content' => 'Saved comment', 'challenge' => $challenge], $headers)->assertCreated();
    $this->postJson($url, ['content' => 'Saved comment', 'challenge' => $challenge], $headers)->assertUnprocessable()->assertJsonValidationErrors('content');
    expect(DB::table('guest_comment_days')->first()->comment_count)->toBe(1);
});

test('mobile challenges bind identity resource kind and time without accepting website session challenges', function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    $news = News::factory()->create();
    $other = News::factory()->create();
    $video = mobileCommentVideo();
    $headers = mobileCommentHeaders($this);
    $url = '/api/news/'.$news->getKey().'/comment';
    $fresh = $this->getJson('/api/news/'.$news->getKey().'/comment-context', $headers)->assertOk()->json('challenge');
    $this->postJson($url, ['content' => 'Too fast', 'challenge' => $fresh], $headers)->assertUnprocessable();
    $challenge = mobileCommentChallenge($this, 'news', $news->getKey(), $headers);
    $otherHeaders = mobileCommentHeaders($this);
    $this->postJson($url, ['content' => 'Wrong identity', 'challenge' => $challenge], $otherHeaders)->assertUnprocessable();
    $this->postJson('/api/news/'.$other->getKey().'/comment', ['content' => 'Wrong resource', 'challenge' => $challenge], $headers)->assertUnprocessable();
    $this->postJson('/api/shorts/'.$video->id.'/comments', ['content' => 'Wrong kind', 'challenge' => $challenge], $headers)->assertUnprocessable();
    $claim = json_decode(Crypt::decryptString($challenge), true);
    $claim['time'] = now()->timestamp - 7201;
    $this->postJson($url, ['content' => 'Expired', 'challenge' => Crypt::encryptString(json_encode($claim))], $headers)->assertUnprocessable();
    expect(Comment::count())->toBe(0)->and(ShortVideoComment::count())->toBe(0)->and(DB::table('guest_comment_days')->count())->toBe(0);
});

test('mobile credentials cannot access private routes and invalid bearer cannot fall back to guest', function () {
    $headers = mobileCommentHeaders($this);
    $news = News::factory()->create();
    $url = '/api/news/'.$news->getKey().'/comment';
    $this->postJson($url, ['content' => 'No credential'])->assertUnauthorized();
    $this->postJson($url, ['content' => 'Bad credential'], ['X-Guest-Token' => str_repeat('a', 64)])->assertUnauthorized();
    $this->postJson($url, ['content' => 'Bad auth'], $headers + ['Authorization' => 'Bearer bad-token'])->assertUnauthorized();
    $this->getJson('/api/profile', $headers)->assertUnauthorized();
    $this->postJson('/api/comments/1/report', ['reason' => 'Report'], $headers)->assertUnauthorized();
    expect(DB::table('guest_comment_identities')->count())->toBe(1);
});

test('pending mobile comments consume quota and stay out of the public list', function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    config(['engagement.openai_key' => '']);
    $video = mobileCommentVideo();
    $headers = mobileCommentHeaders($this);
    $challenge = mobileCommentChallenge($this, 'short', $video->id, $headers);
    $this->postJson('/api/shorts/'.$video->id.'/comments', ['content' => 'Needs moderation', 'challenge' => $challenge], $headers)
        ->assertCreated()->assertJsonPath('status', 'pending_review')->assertJsonPath('remaining_quota', 2)->assertJsonPath('comment', null);
    $this->getJson('/api/shorts/'.$video->id.'/comments')->assertOk()->assertJsonPath('count', 0);
    expect(DB::table('guest_comment_days')->first()->comment_count)->toBe(1);
});

test('authenticated mobile comments stay exempt and retain five requests per minute throttle', function () {
    $news = News::factory()->create();
    $headers = ['Authorization' => 'Bearer '.User::factory()->create()->createToken('test')->plainTextToken];
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/news/'.$news->getKey().'/comment', ['content' => 'Authenticated '.$i], $headers)
            ->assertCreated()->assertJsonPath('remaining_quota', null);
    }
    $this->postJson('/api/news/'.$news->getKey().'/comment', ['content' => 'Throttled'], $headers)->assertTooManyRequests();
    expect(DB::table('guest_comment_days')->count())->toBe(0)->and(Comment::count())->toBe(5);
});

test('mobile guest submissions keep five requests per minute across News and Shorts', function () {
    $news = News::factory()->create();
    $video = mobileCommentVideo();
    $headers = mobileCommentHeaders($this);
    $challenge = mobileCommentChallenge($this, 'news', $news->getKey(), $headers);
    $shortChallenge = mobileCommentChallenge($this, 'short', $video->id, $headers);
    for ($i = 0; $i < 5; $i++) {
        $result = $this->postJson('/api/news/'.$news->getKey().'/comment', ['content' => 'Guest '.$i, 'challenge' => $challenge], $headers);
        $i < 3 ? $result->assertCreated() : $result->assertUnprocessable()->assertJsonPath('code', 'guest_comment_quota_exceeded');
    }
    $this->postJson('/api/shorts/'.$video->id.'/comments', ['content' => 'Throttled', 'challenge' => $shortChallenge], $headers)->assertTooManyRequests();
    expect(DB::table('guest_comment_days')->first()->comment_count)->toBe(3);
});

test('a failing comment service rolls back the mobile daily quota', function () {
    $news = News::factory()->create();
    $headers = mobileCommentHeaders($this);
    $challenge = mobileCommentChallenge($this, 'news', $news->getKey(), $headers);
    $this->mock(InteractionService::class, function ($mock) {
        $mock->shouldReceive('addComment')->once()->andThrow(new RuntimeException('Simulated save failure'));
    });
    $this->postJson('/api/news/'.$news->getKey().'/comment', ['content' => 'Failed save', 'challenge' => $challenge], $headers)
        ->assertStatus(500);
    expect(DB::table('guest_comment_days')->count())->toBe(0)->and(Comment::count())->toBe(0);
});

test('website and mobile credentials use the same identity and daily quota records', function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    $news = News::factory()->create();
    $headers = mobileCommentHeaders($this);
    $challenge = mobileCommentChallenge($this, 'news', $news->getKey(), $headers);
    $this->postJson('/api/news/'.$news->getKey().'/comment', ['content' => 'Mobile comment', 'challenge' => $challenge], $headers)
        ->assertCreated()->assertJsonPath('remaining_quota', 2);
    $this->withCredentials()->withCookie(GuestCommentIdentity::COOKIE, $headers['X-Guest-Token']);
    $token = $this->getJson('/news/'.$news->getKey().'/engagement')->assertOk()->json('token');
    $this->withCookie(config('session.cookie'), app('session')->getId());
    $claim = json_decode(Crypt::decryptString($token), true);
    $claim['time'] -= 4;
    $this->postJson('/news/'.$news->getKey().'/comment', ['content' => 'Website comment', 'challenge' => Crypt::encryptString(json_encode($claim))])
        ->assertCreated()->assertJsonPath('remaining_quota', 1);
    expect(DB::table('guest_comment_identities')->count())->toBe(1)
        ->and(DB::table('guest_comment_days')->first()->comment_count)->toBe(2);
});
