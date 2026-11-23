<?php

use App\Models\Comment;
use App\Models\Like;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->uc7News = News::factory()->create(['title' => 'Community programme update']);
    $this->uc7Url = '/news/'.$this->uc7News->getKey();
    $this->uc7Reader = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'villager'])->getKey()]);
    $this->uc7Admin = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
});

function uc7Comment($test): Comment
{
    return Comment::create([
        'newsID' => $test->uc7News->getKey(), 'userID' => $test->uc7Reader->getKey(),
        'content' => 'Please review this community comment.', 'status' => 'published',
    ]);
}

function uc7Flag($test, Comment $comment): void
{
    $test->actingAs($test->uc7Admin)->postJson('/admin/news/'.$comment->newsID.'/moderation-comments/'.$comment->getKey().'/flag', [
        'category' => 'spam', 'explanation' => 'Repeated promotional content',
    ])->assertOk();
}

test('TC-UC7-01 likes and unlikes news with updated counts', function () {
    $this->actingAs($this->uc7Reader)->postJson($this->uc7Url.'/like')->assertOk()->assertJson(['liked' => true, 'likes_count' => 1]);
    $this->getJson($this->uc7Url)->assertOk()->assertJsonPath('data.liked_by_user', true);
    $this->postJson($this->uc7Url.'/like')->assertOk()->assertJson(['liked' => false, 'likes_count' => 0]);
    expect(Like::count())->toBe(0);
});

test('TC-UC7-02 submits and displays a comment without external AI calls', function () {
    $this->actingAs($this->uc7Reader)->postJson($this->uc7Url.'/comment', ['content' => 'Thank you for the community update.'])
        ->assertCreated()->assertJsonPath('status', 'published')->assertJsonPath('comments_count', 1);
    $this->getJson($this->uc7Url)->assertJsonPath('data.comments_list.0.content', 'Thank you for the community update.');
    expect(Comment::sole()->ai_flagged)->toBeNull();
    Http::assertNothingSent();
});

test('TC-UC7-03 submits and displays a reply with its parent', function () {
    $parent = uc7Comment($this);
    $this->actingAs($this->uc7Reader)->postJson('/comments/'.$parent->getKey().'/replies', ['content' => 'This is a useful clarification.'])->assertCreated();
    $this->assertDatabaseHas('comments', ['parentID' => $parent->getKey(), 'content' => 'This is a useful clarification.']);
    $this->getJson($this->uc7Url)->assertJsonPath('data.comments', 2);
});

test('TC-UC7-04 stores report category and details and prevents duplicate reports', function () {
    $comment = uc7Comment($this);
    $url = '/comments/'.$comment->getKey().'/report';
    $this->actingAs($this->uc7Reader)->postJson($url, ['category' => 'Spam', 'details' => 'Repeated promotion'])->assertOk();
    $this->postJson($url, ['category' => 'Lainnya', 'details' => 'Replacement'])->assertOk();
    expect(DB::table('comment_reports')->count())->toBe(1)
        ->and(DB::table('comment_reports')->value('category'))->toBe('Spam')
        ->and(DB::table('comment_reports')->value('explanation'))->toBe('Repeated promotion');
});

test('TC-UC7-05 flags a comment and filters the admin queue', function () {
    $comment = uc7Comment($this);
    uc7Flag($this, $comment);
    $this->get('/admin/comments?source=admin')->assertInertia(fn (Assert $page) => $page->has('comments.data', 1)->where('counts.admin', 1));
    expect($comment->fresh()->status)->toBe('published')->and(DB::table('comment_flags')->count())->toBe(1);
});

test('TC-UC7-06 filters reported comments with reporter details', function () {
    $comment = uc7Comment($this);
    $this->actingAs($this->uc7Reader)->postJson('/comments/'.$comment->getKey().'/report', ['category' => 'Spam', 'details' => 'Repeated promotion'])->assertOk();
    $this->actingAs($this->uc7Admin)->get('/admin/comments?source=reported')->assertInertia(fn (Assert $page) => $page
        ->has('comments.data', 1)->where('comments.data.0.reports.0.category', 'Spam')
        ->where('comments.data.0.reports.0.explanation', 'Repeated promotion'));
});

test('TC-UC7-07 hides a comment and records the admin decision', function () {
    $comment = uc7Comment($this);
    uc7Flag($this, $comment);
    $this->postJson('/admin/comments/'.$comment->getKey().'/decision', ['action' => 'hide', 'reason' => 'Confirmed spam', 'expected_revision' => 0])->assertOk();
    expect($comment->fresh()->status)->toBe('hidden');
    $this->getJson($this->uc7Url)->assertJsonPath('data.comments', 0);
    $this->assertDatabaseHas('comment_moderation_history', ['comment_id' => $comment->getKey(), 'moderator_id' => $this->uc7Admin->getKey(), 'action' => 'hide', 'reason' => 'Confirmed spam']);
});

test('TC-UC7-08 allows a reported comment and resolves its report', function () {
    $comment = uc7Comment($this);
    $this->actingAs($this->uc7Reader)->postJson('/comments/'.$comment->getKey().'/report', ['category' => 'Spam'])->assertOk();
    $this->actingAs($this->uc7Admin)->postJson('/admin/comments/'.$comment->getKey().'/decision', ['action' => 'allow', 'expected_revision' => 0])->assertOk();
    expect($comment->fresh()->status)->toBe('published')->and(DB::table('comment_reports')->value('resolved_at'))->not->toBeNull();
    $this->get('/admin/comments?source=reported')->assertInertia(fn (Assert $page) => $page->has('comments.data', 0));
});

test('TC-UC7-09 restores hidden comments and preserves moderation history', function () {
    $comment = uc7Comment($this);
    uc7Flag($this, $comment);
    $url = '/admin/comments/'.$comment->getKey().'/decision';
    $this->postJson($url, ['action' => 'hide', 'expected_revision' => 0])->assertOk();
    $this->postJson($url, ['action' => 'allow', 'reason' => 'Appeal accepted', 'expected_revision' => 1])->assertOk();
    expect($comment->fresh()->status)->toBe('published')->and($comment->fresh()->content)->toBe($comment->content)
        ->and(DB::table('comment_moderation_history')->count())->toBe(2);
    $this->get('/admin/comments?tab=history&decision=restored')->assertInertia(fn (Assert $page) => $page->has('comments.data', 1));
});

test('TC-UC7-10 accepts authenticated mobile comments and reports', function () {
    $headers = ['Authorization' => 'Bearer '.$this->uc7Reader->createToken('uc7-mobile')->plainTextToken];
    $this->postJson('/api/news/'.$this->uc7News->getKey().'/comment', ['content' => 'Comment submitted from mobile.'], $headers)->assertCreated();
    $comment = Comment::sole();
    $this->postJson('/api/comments/'.$comment->getKey().'/report', ['category' => 'Spam', 'details' => 'Mobile report'], $headers)->assertOk();
    $this->assertDatabaseHas('comment_reports', ['comment_id' => $comment->getKey(), 'explanation' => 'Mobile report']);
});

test('TC-UC7-11 returns the correct article title for the mobile share source', function () {
    $this->getJson('/api/news/'.$this->uc7News->getKey())->assertOk()
        ->assertJsonPath('data.title', 'Community programme update')
        ->assertJsonPath('data.id', (string) $this->uc7News->getKey());
    $this->get($this->uc7Url)->assertOk();
});

test('TC-UC7-12 rejects empty comments without storing them', function () {
    $this->actingAs($this->uc7Reader)->postJson($this->uc7Url.'/comment', ['content' => ''])->assertUnprocessable()->assertJsonValidationErrors('content');
    expect(Comment::count())->toBe(0);
});

test('TC-UC7-13 rejects duplicate comment submissions', function () {
    $this->actingAs($this->uc7Reader)->postJson($this->uc7Url.'/comment', ['content' => 'Duplicate community comment'])->assertCreated();
    $this->postJson($this->uc7Url.'/comment', ['content' => 'Duplicate community comment'])->assertUnprocessable();
    expect(Comment::count())->toBe(1);
});

test('TC-UC7-14 rejects an invalid report category', function () {
    $comment = uc7Comment($this);
    $this->actingAs($this->uc7Reader)->postJson('/comments/'.$comment->getKey().'/report', ['category' => 'invalid'])->assertUnprocessable();
    expect(DB::table('comment_reports')->count())->toBe(0);
});

test('TC-UC7-15 prevents guests from liking or reporting', function () {
    $comment = uc7Comment($this);
    $this->postJson($this->uc7Url.'/like')->assertUnauthorized();
    $this->postJson('/comments/'.$comment->getKey().'/report', ['category' => 'Spam'])->assertUnauthorized();
    expect(Like::count())->toBe(0)->and(DB::table('comment_reports')->count())->toBe(0);
});

test('TC-UC7-16 prevents villagers from accessing moderation or flagging', function () {
    $comment = uc7Comment($this);
    $this->actingAs($this->uc7Reader)->get('/admin/comments')->assertRedirect('/');
    $this->postJson('/admin/comments/'.$comment->getKey().'/decision', ['action' => 'hide'])->assertRedirect('/');
    $this->postJson('/admin/news/'.$comment->newsID.'/moderation-comments/'.$comment->getKey().'/flag', ['category' => 'spam'])->assertForbidden();
    expect($comment->fresh()->status)->toBe('published')->and(DB::table('comment_flags')->count())->toBe(0);
});

test('TC-UC7-17 rejects a stale moderation decision', function () {
    $comment = uc7Comment($this);
    uc7Flag($this, $comment);
    $url = '/admin/comments/'.$comment->getKey().'/decision';
    $this->postJson($url, ['action' => 'hide', 'expected_revision' => 0])->assertOk();
    $this->postJson($url, ['action' => 'allow', 'expected_revision' => 0])->assertConflict();
    expect($comment->fresh()->status)->toBe('hidden')->and(DB::table('comment_moderation_history')->count())->toBe(1);
});

test('TC-UC7-18 blocks engagement on archived news', function () {
    $this->uc7News->update(['status' => 'archived']);
    $this->actingAs($this->uc7Reader)->postJson($this->uc7Url.'/like')->assertNotFound();
    $this->postJson($this->uc7Url.'/comment', ['content' => 'Archived news comment'])->assertNotFound();
    expect(Comment::count())->toBe(0)->and(Like::count())->toBe(0);
});

test('TC-UC7-19 rejects replies to hidden comments', function () {
    $comment = uc7Comment($this);
    $comment->update(['status' => 'hidden']);
    $this->actingAs($this->uc7Reader)->postJson('/comments/'.$comment->getKey().'/replies', ['content' => 'Reply to hidden comment'])->assertNotFound();
    expect(Comment::count())->toBe(1);
});
