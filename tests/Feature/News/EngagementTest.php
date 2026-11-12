<?php

use App\Models\Comment;
use App\Models\Like;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use App\Services\News\CommentModeration;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['engagement.openai_key' => 'test-key']);
    Http::preventStrayRequests();
    Http::fake(['api.openai.com/*' => Http::response(['results' => [['flagged' => false, 'categories' => ['harassment' => false]]]])]);
    $this->article = News::factory()->create();
    $this->url = '/news/'.$this->article->getKey();
});

function agedEngagementToken($test, int $seconds = 6): string
{
    $test->withCredentials();
    $token = $test->getJson($test->url.'/engagement')->assertOk()->json('token');
    $test->withCookie(config('session.cookie'), app('session')->getId());
    $data = json_decode(Crypt::decryptString($token), true);
    $data['time'] -= $seconds;

    return Crypt::encryptString(json_encode($data));
}

test('guests cannot like or report and article GETs never count views', function () {
    $this->postJson($this->url.'/like')->assertUnauthorized();
    $this->postJson('/comments/1/report', ['reason' => 'spam'])->assertUnauthorized();
    $this->getJson($this->url)->assertOk();
    $this->getJson($this->url)->assertOk();
    expect($this->article->fresh()->view)->toBe(0)->and(Like::count())->toBe(0);
});

test('likes toggle persist and work for all registered roles', function (string $role) {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => $role])->getKey()]);
    $this->actingAs($user)->postJson($this->url.'/like')->assertOk()->assertJson(['liked' => true, 'likes_count' => 1]);
    $this->getJson($this->url)->assertJsonPath('data.liked_by_user', true);
    $this->postJson($this->url.'/like')->assertOk()->assertJson(['liked' => false, 'likes_count' => 0]);
    expect(Like::count())->toBe(0);
})->with(['villager', 'admin', 'moderator']);

test('authenticated repeat visits increase totals but only one unique viewer', function () {
    $this->actingAs(User::factory()->create());
    $token = agedEngagementToken($this);
    $this->postJson($this->url.'/view', ['token' => $token])->assertOk()->assertJsonPath('unique_views', 1);
    $this->postJson($this->url.'/view', ['token' => $token])->assertOk();
    $this->postJson($this->url.'/view', ['token' => agedEngagementToken($this)])->assertOk();
    expect($this->article->fresh()->view)->toBe(2)->and($this->article->fresh()->unique_views)->toBe(1);
});

test('anonymous cookie deduplicates viewers without IP identity', function () {
    $this->withCookie('news_visitor', '7bf8d84d-472d-435b-931e-7b7685b4ff5b');
    $this->postJson($this->url.'/view', ['token' => agedEngagementToken($this)])->assertOk();
    $this->postJson($this->url.'/view', ['token' => agedEngagementToken($this)])->assertOk();
    expect($this->article->fresh()->unique_views)->toBe(1)->and(DB::table('news_viewers')->first()->expires_at)->not->toBeNull();
    $this->withCookie('news_visitor', 'c9678fd5-d1da-41be-8f97-c08404a51075');
    $this->postJson($this->url.'/view', ['token' => agedEngagementToken($this)])->assertOk();
    expect($this->article->fresh()->unique_views)->toBe(2);
});

test('early forged expired and cross article views are rejected', function () {
    $token = agedEngagementToken($this, 0);
    $this->postJson($this->url.'/view', ['token' => $token])->assertUnprocessable();
    $this->postJson($this->url.'/view', ['token' => 'forged'])->assertUnprocessable();
    $this->postJson($this->url.'/view', ['token' => agedEngagementToken($this, 7201)])->assertUnprocessable();
    $other = News::factory()->create();
    $this->postJson('/news/'.$other->getKey().'/view', ['token' => agedEngagementToken($this)])->assertUnprocessable();
    expect($this->article->fresh()->view)->toBe(0);
});

test('guest comments publish only after bot and moderation checks', function () {
    $this->postJson($this->url.'/comment', ['content' => 'Terima kasih'])->assertUnprocessable();
    $token = agedEngagementToken($this);
    $this->postJson($this->url.'/comment', ['content' => 'Terima kasih', 'challenge' => $token, 'website' => 'spam'])->assertUnprocessable();
    $this->postJson($this->url.'/comment', ['content' => 'Terima kasih', 'guest_name' => 'Warga', 'challenge' => $token])->assertCreated()->assertJsonPath('status', 'published');
    expect(Comment::first()->userID)->toBeNull()
        ->and(Comment::first()->guest_name)->toMatch('/^Guest[0-9]{5}$/');
    $this->getJson($this->url)->assertJsonPath('data.comments_list.0.author', Comment::first()->guest_name)->assertJsonMissingPath('data.comments_list.0.moderation_categories');
    $this->get($this->url)->assertInertia(fn (Assert $page) => $page->has('comments', 1));
    $this->postJson($this->url.'/comment', ['content' => 'Informasi yang membantu', 'challenge' => $token])->assertCreated();
    expect(Comment::latest('commentID')->first()->guest_name)->toMatch('/^Guest[0-9]{5}$/');
});

test('English Indonesian mixed slang and criticism are sent unchanged to moderation', function (string $content) {
    $this->actingAs(User::factory()->create())->postJson($this->url.'/comment', ['content' => $content])->assertCreated()->assertJsonPath('status', 'published');
    Http::assertSent(fn ($request) => $request['input'] === $content && $request['model'] === 'omni-moderation-latest');
})->with(['Thank you for the update.', 'Terima kasih atas informasinya.', 'Thanks, beritanya sangat membantu.', 'Makasih min, infonya mantap banget.', 'Saya tidak setuju dengan kebijakan ini; anggarannya perlu dijelaskan.']);

test('flagged threats and offensive language are held and hidden', function (string $content) {
    Http::swap(new Factory);
    Http::fake(['api.openai.com/*' => Http::response(['results' => [['flagged' => true, 'categories' => ['harassment' => true]]]])]);
    $this->actingAs(User::factory()->create())->postJson($this->url.'/comment', ['content' => $content])->assertCreated()->assertJsonPath('status', 'pending_review');
    $this->getJson($this->url)->assertJsonPath('data.comments', 0);
    expect(Comment::first()->ai_flagged)->toBeTrue();
})->with(['I will hurt you.', 'Dasar bodoh, kamu tidak berguna.']);

test('API failures timeouts malformed responses and missing key fail closed', function (string $failure) {
    Http::swap(new Factory);
    if ($failure === 'key') {
        config(['engagement.openai_key' => null]);
    } elseif ($failure === 'timeout') {
        Http::fake(fn () => throw new ConnectionException('timeout'));
    } elseif ($failure === 'malformed') {
        Http::fake(['*' => Http::response(['results' => [['flagged' => false]]])]);
    } else {
        Http::fake(['*' => Http::response([], 503)]);
    }
    expect(app(CommentModeration::class)->check('Normal comment')['status'])->toBe('pending_review');
})->with(['key', 'timeout', 'malformed', 'server']);

test('links cleared by AI are published and duplicates are blocked', function () {
    $this->actingAs(User::factory()->create());
    $this->postJson($this->url.'/comment', ['content' => 'Promo murah https://example.com'])->assertCreated()->assertJsonPath('status', 'published');
    $this->postJson($this->url.'/comment', ['content' => 'Promo murah https://example.com'])->assertUnprocessable();
    expect(Comment::count())->toBe(1);
});

test('admin decisions reports and history are protected and enforce transitions', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->postJson($this->url.'/comment', ['content' => 'A helpful comment'])->assertCreated();
    $comment = Comment::first();
    $this->postJson('/comments/'.$comment->getKey().'/report', ['reason' => 'Please review'])->assertOk();
    $this->postJson('/comments/'.$comment->getKey().'/report', ['reason' => 'Duplicate report'])->assertOk();
    expect(DB::table('comment_reports')->count())->toBe(1);
    $decision = '/admin/comments/'.$comment->getKey().'/decision';
    $this->get('/admin/comments')->assertRedirect('/');
    $this->postJson($decision, ['action' => 'hide', 'reason' => 'review'])->assertRedirect('/');
    $admin = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $this->actingAs($admin)->get('/admin/comments?status=reported')->assertOk();
    $this->postJson($decision, ['action' => 'hide', 'reason' => 'Violation'])->assertOk();
    $this->getJson($this->url)->assertJsonPath('data.comments', 0);
    $this->postJson($decision, ['action' => 'hide', 'reason' => 'Invalid transition'])->assertConflict();
    $this->postJson($decision, ['action' => 'allow', 'reason' => 'Appeal accepted'])->assertOk();
    expect($comment->fresh()->status)->toBe('published')->and(DB::table('comment_moderation_history')->count())->toBe(3);
    $comment->refresh()->update(['status' => 'pending_review']);
    $this->postJson($decision, ['action' => 'hide', 'reason' => 'Not acceptable'])->assertOk();
    $this->postJson($decision, ['action' => 'allow', 'reason' => 'Appeal accepted after rejection'])->assertOk();
    $comment->refresh()->update(['status' => 'pending_review']);
    $this->postJson($decision, ['action' => 'allow', 'reason' => 'Reviewed'])->assertOk();
});

test('unpublished articles cannot receive engagement', function () {
    $this->article->update(['status' => 'archived']);
    $this->actingAs(User::factory()->create())->postJson($this->url.'/like')->assertNotFound();
    $this->postJson($this->url.'/comment', ['content' => 'Comment'])->assertNotFound();
    $this->getJson($this->url.'/engagement')->assertNotFound();
});

test('replies receive moderation and disappear when ancestor is removed', function () {
    $this->actingAs(User::factory()->create())->postJson($this->url.'/comment', ['content' => 'Root'])->assertCreated();
    $parent = Comment::first();
    $this->postJson('/comments/'.$parent->getKey().'/replies', ['content' => 'Reply'])->assertCreated();
    $parent->update(['status' => 'removed']);
    $this->getJson($this->url)->assertJsonPath('data.comments', 0);
    $this->postJson('/comments/'.$parent->getKey().'/replies', ['content' => 'Another'])->assertNotFound();
});

test('comment rate limiting applies before repeated moderation calls', function () {
    $this->actingAs(User::factory()->create());
    for ($i = 0; $i < 5; $i++) {
        $this->postJson($this->url.'/comment', ['content' => 'Comment '.$i])->assertCreated();
    }
    $this->postJson($this->url.'/comment', ['content' => 'One too many'])->assertStatus(429);
    Http::assertSentCount(5);
});

test('comment and reply likes persist with per-user counts and reject guests', function () {
    $this->postJson('/comments/1/like')->assertUnauthorized();
    $user = User::factory()->create();
    $this->actingAs($user)->postJson($this->url.'/comment', ['content' => 'Komentar utama'])->assertCreated();
    $parent = Comment::first();
    $this->postJson('/comments/'.$parent->getKey().'/replies', ['content' => 'Balasan pertama'])->assertCreated();
    foreach (Comment::all() as $comment) {
        $endpoint = '/comments/'.$comment->getKey().'/like';
        $this->postJson($endpoint)->assertOk()->assertJson(['liked' => true, 'likes_count' => 1]);
        $this->actingAs(User::factory()->create())->postJson($endpoint)->assertOk()->assertJson(['liked' => true, 'likes_count' => 2]);
        $this->postJson($endpoint)->assertOk()->assertJson(['liked' => false, 'likes_count' => 1]);
        $this->actingAs($user);
    }
    $this->getJson($this->url)->assertJsonPath('data.comments_list.0.likes_count', 1)
        ->assertJsonPath('data.comments_list.0.liked_by_user', true)
        ->assertJsonPath('data.comments_list.1.likes_count', 1);
    $parent->update(['status' => 'removed']);
    $this->postJson('/comments/'.$parent->getKey().'/like')->assertNotFound();
});

test('report categories reach moderation and duplicate reports preserve the original', function () {
    $this->actingAs(User::factory()->create())->postJson($this->url.'/comment', ['content' => 'Komentar untuk ditinjau'])->assertCreated();
    $endpoint = '/comments/'.Comment::first()->getKey().'/report';
    $this->postJson($endpoint, [])->assertUnprocessable();
    $this->postJson($endpoint, ['category' => 'invalid'])->assertUnprocessable();
    $this->postJson($endpoint, ['category' => 'Spam', 'details' => 'Pesan berulang'])->assertOk();
    $this->postJson($endpoint, ['category' => 'Lainnya'])->assertOk();
    expect(DB::table('comment_reports')->count())->toBe(1)
        ->and(DB::table('comment_reports')->value('category'))->toBe('Spam')
        ->and(DB::table('comment_reports')->value('explanation'))->toBe('Pesan berulang');
    $this->getJson($this->url)->assertJsonPath('data.comments_list.0.reported_by_user', true);
});

test('public comments retain deep reply targets and expose an avatar fallback', function () {
    $user = User::factory()->create();
    $root = Comment::create(['newsID' => $this->article->getKey(), 'userID' => $user->getKey(), 'content' => 'Root', 'status' => 'published']);
    $reply = Comment::create(['newsID' => $this->article->getKey(), 'userID' => $user->getKey(), 'parentID' => $root->getKey(), 'content' => 'Reply', 'status' => 'published']);
    $nested = Comment::create(['newsID' => $this->article->getKey(), 'userID' => $user->getKey(), 'parentID' => $reply->getKey(), 'content' => 'Nested reply', 'status' => 'published']);
    $comments = collect($this->getJson($this->url)->assertOk()->json('data.comments_list'))->keyBy('id');
    expect($comments[(string) $nested->getKey()]['parent_id'])->toBe((string) $reply->getKey())
        ->and($comments[(string) $root->getKey()])->toHaveKey('avatar', null)
        ->and($comments[(string) $reply->getKey()]['author'])->toBe($user->name);
});
