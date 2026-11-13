<?php

use App\Models\Comment;
use App\Models\News;
use App\Models\User;
use App\Services\News\CommentModeration;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    $this->mock(CommentModeration::class)->shouldReceive('check')->andReturn([
        'status' => 'published', 'ai_flagged' => false,
        'moderation_categories' => [], 'moderation_reason' => 'checks_passed',
    ]);
});

test('old and recent posts accept matching text from different readers and separate reply targets', function (string $date) {
    $news = News::factory()->create(['created_at' => $date]);
    $first = User::factory()->create();
    $second = User::factory()->create();
    $headers = fn ($user) => ['Authorization' => 'Bearer '.$user->createToken('scope-test')->plainTextToken];
    $a = $headers($first);
    $b = $headers($second);
    $url = '/api/news/'.$news->getKey().'/comment';
    $this->postJson($url, ['content' => 'Terima kasih'], $a)->assertCreated()->assertJsonPath('comments_count', 1);
    $root = Comment::first();
    $this->postJson($url, ['content' => 'Terima kasih'], $b)->assertCreated()->assertJsonPath('comments_count', 2);
    $this->postJson('/api/comments/'.$root->getKey().'/replies', ['content' => 'Terima kasih'], $a)
        ->assertCreated()->assertJsonPath('comments_count', 3);
    $this->postJson($url, ['content' => '  TERIMA   KASIH  '], $a)->assertUnprocessable()->assertJsonValidationErrors('content');
    $this->postJson('/api/comments/'.$root->getKey().'/replies', ['content' => 'Terima kasih'], $a)->assertUnprocessable();
    $this->assertDatabaseHas('comments', ['newsID' => $news->getKey(), 'userID' => $first->getKey(), 'parentID' => $root->getKey()]);
    expect(Comment::count())->toBe(3)->and(DB::table('comment_moderation_history')->count())->toBe(3);
    $this->getJson('/api/news')->assertJsonFragment(['id' => (string) $news->getKey(), 'comments_count' => 3]);
    $this->getJson('/api/news/'.$news->getKey())->assertJsonPath('data.id', (string) $news->getKey())->assertJsonPath('data.comments_count', 3);
})->with(['2020-01-01 00:00:00', '2026-11-13 10:00:00']);

test('legacy hashes retain same-author duplicate protection without blocking another reader', function () {
    $news = News::factory()->create();
    $first = User::factory()->create();
    $legacy = Comment::create([
        'newsID' => $news->getKey(), 'userID' => $first->getKey(), 'content' => 'Terima kasih',
        'status' => 'pending_review', 'submission_hash' => hash('sha256', $news->getKey().'|terima kasih'),
    ]);
    $original = $legacy->fresh()->getAttributes();
    foreach ([$first, User::factory()->create()] as $index => $user) {
        $response = $this->postJson('/api/news/'.$news->getKey().'/comment', ['content' => 'Terima kasih'], [
            'Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken,
        ]);
        $index === 0 ? $response->assertUnprocessable() : $response->assertCreated()->assertJsonPath('comments_count', 1);
    }
    expect($legacy->fresh()->getAttributes())->toBe($original);
});

test('guest duplicate protection belongs to the guest identity and keeps its daily quota', function () {
    $news = News::factory()->create();
    foreach ([1, 2] as $count) {
        $headers = ['X-Guest-Token' => $this->postJson('/api/guest-comments/identity')->json('token')];
        $challenge = $this->getJson('/api/news/'.$news->getKey().'/comment-context', $headers)->assertOk()->json('challenge');
        $claim = json_decode(Crypt::decryptString($challenge), true);
        $claim['time'] -= 4;
        $payload = ['content' => 'Terima kasih', 'challenge' => Crypt::encryptString(json_encode($claim))];
        $this->postJson('/api/news/'.$news->getKey().'/comment', $payload, $headers)
            ->assertCreated()->assertJsonPath('comments_count', $count)->assertJsonPath('remaining_quota', 2);
        $this->postJson('/api/news/'.$news->getKey().'/comment', $payload, $headers)->assertUnprocessable();
    }
    expect(DB::table('guest_comment_days')->sum('comment_count'))->toBe(2)->and(Comment::count())->toBe(2);
});

test('an unavailable moderation assessment stays saved and does not increment the public count', function () {
    $this->mock(CommentModeration::class)->shouldReceive('check')->andReturn([
        'status' => 'pending_review', 'ai_flagged' => null,
        'moderation_categories' => [], 'moderation_reason' => 'moderation_unavailable',
    ]);
    $news = News::factory()->create();
    $user = User::factory()->create();
    $this->postJson('/api/news/'.$news->getKey().'/comment', ['content' => 'Pending'], [
        'Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken,
    ])->assertCreated()->assertJsonPath('status', 'pending_review')->assertJsonPath('comments_count', 0);
    $this->assertDatabaseHas('comments', ['newsID' => $news->getKey(), 'userID' => $user->getKey(), 'status' => 'pending_review']);
});
