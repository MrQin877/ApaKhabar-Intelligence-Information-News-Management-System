<?php

use App\Models\Comment;
use App\Models\CommentModerationAssessment;
use App\Models\CommentModerationFeedback;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['engagement.openai_key' => 'test-key']);
    Http::preventStrayRequests();
    Http::fake(['api.openai.com/*' => Http::response([
        'model' => 'moderation-test-snapshot',
        'results' => [['flagged' => false, 'categories' => ['harassment' => false], 'category_scores' => ['harassment' => 0.01]]],
    ])]);
    $this->article = News::factory()->create();
    $this->reader = User::factory()->create();
    $this->admin = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $this->actingAs($this->reader)->postJson('/news/'.$this->article->getKey().'/comment', ['content' => 'Komentar untuk ditinjau'])->assertCreated();
    $this->comment = Comment::first();
    $this->base = '/admin/news/'.$this->article->getKey().'/moderation-comments';
    $this->endpoint = $this->base.'/'.$this->comment->getKey().'/feedback';
    $this->payload = [
        'classification' => 'inappropriate', 'category' => 'indirect_insult',
        'explanation' => 'Hinaan tersirat dalam konteks percakapan.',
        'expected_revision' => 0, 'request_id' => (string) Str::uuid(),
    ];
});

test('admin can correct an AI miss preserving assessment history reports and replies', function () {
    $assessment = CommentModerationAssessment::first()->getAttributes();
    $this->postJson('/comments/'.$this->comment->getKey().'/replies', ['content' => 'Balasan yang pantas'])->assertCreated();
    $this->postJson('/comments/'.$this->comment->getKey().'/report', ['reason' => 'Hinaan'])->assertOk();
    $this->actingAs($this->admin)->postJson($this->endpoint, $this->payload)->assertOk();
    $feedback = CommentModerationFeedback::first();
    expect($this->comment->fresh()->status)->toBe('removed')
        ->and($this->comment->fresh()->moderation_revision)->toBe(1)
        ->and($feedback->classification)->toBe('inappropriate')
        ->and($feedback->category)->toBe('indirect_insult')
        ->and($feedback->explanation)->toBe($this->payload['explanation'])
        ->and($feedback->verification_status)->toBe('unverified')
        ->and((int) $feedback->administrator_id)->toBe($this->admin->getKey())
        ->and(CommentModerationAssessment::find($feedback->assessment_id)->getAttributes())->toBe($assessment)
        ->and(DB::table('comment_reports')->first()->resolved_at)->not->toBeNull()
        ->and(Comment::where('parentID', $this->comment->getKey())->first()->status)->toBe('published');
    $this->assertDatabaseHas('comment_moderation_history', ['id' => $feedback->history_id, 'from_status' => 'published', 'to_status' => 'removed']);
    $this->getJson('/news/'.$this->article->getKey())->assertJsonPath('data.comments', 0);
    Http::assertSentCount(2); // Correction itself makes no AI request.
});

test('only verified administrators can access article moderation endpoints', function (string $role) {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => $role])->getKey()]);
    $this->actingAs($user)->getJson($this->base)->assertForbidden();
    $this->getJson($this->base.'/'.$this->comment->getKey())->assertForbidden();
    $this->postJson($this->endpoint, $this->payload)->assertForbidden();
    expect(CommentModerationFeedback::count())->toBe(0)->and($this->comment->fresh()->status)->toBe('published');
})->with(['villager', 'moderator']);

test('guests and unverified admins cannot fetch private comments or correct them', function () {
    auth()->forgetGuards();
    $this->getJson($this->base)->assertUnauthorized();
    $this->postJson($this->endpoint, $this->payload)->assertUnauthorized();
    $user = User::factory()->unverified()->create(['roleID' => $this->admin->roleID]);
    $this->actingAs($user)->getJson($this->base)->assertForbidden();
    $this->postJson($this->endpoint, $this->payload)->assertForbidden();
});

test('duplicate retries are idempotent and changed payloads cannot reuse the key', function () {
    $this->actingAs($this->admin)->postJson($this->endpoint, $this->payload)->assertOk();
    $this->postJson($this->endpoint, $this->payload)->assertOk();
    $this->postJson($this->endpoint, [...$this->payload, 'category' => 'spam'])->assertConflict();
    expect(CommentModerationFeedback::count())->toBe(1)
        ->and(DB::table('comment_moderation_history')->whereNotNull('from_status')->count())->toBe(1);
});

test('client supplied administrator assessment and verification fields are ignored', function () {
    $this->actingAs($this->admin)->postJson($this->endpoint, [
        ...$this->payload, 'administrator_id' => $this->reader->getKey(),
        'assessment_id' => 999, 'verification_status' => 'verified', 'ai_flagged' => true,
    ])->assertOk();
    $feedback = CommentModerationFeedback::first();
    expect((int) $feedback->administrator_id)->toBe($this->admin->getKey())
        ->and($feedback->verification_status)->toBe('unverified')
        ->and(CommentModerationAssessment::find($feedback->assessment_id)->classification)->toBe('not_flagged');
    expect(fn () => $feedback->update(['classification' => 'appropriate']))->toThrow(LogicException::class);
});

test('dashboard rejects supplied stale revisions and keeps moderator permissions', function () {
    $moderator = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'moderator'])->getKey()]);
    $url = '/admin/comments/'.$this->comment->getKey().'/decision';
    $this->actingAs($moderator)->postJson($url, ['action' => 'remove', 'reason' => 'Ditinjau', 'expected_revision' => 0])->assertOk();
    $this->postJson($url, ['action' => 'restore', 'reason' => 'Pulihkan', 'expected_revision' => 0])->assertConflict();
    expect($this->comment->fresh()->status)->toBe('removed')->and(CommentModerationFeedback::count())->toBe(0);
});

test('a stale correction cannot override dashboard decisions even after a status round trip', function () {
    $this->actingAs($this->admin);
    $decision = '/admin/comments/'.$this->comment->getKey().'/decision';
    $this->postJson($decision, ['action' => 'remove', 'reason' => 'Tinjau'])->assertOk();
    $this->postJson($decision, ['action' => 'restore', 'reason' => 'Pulihkan'])->assertOk();
    $this->postJson($this->endpoint, $this->payload)->assertConflict();
    expect($this->comment->fresh()->status)->toBe('published')->and(CommentModerationFeedback::count())->toBe(0);
});

test('pending AI false positives can be approved without replacing original flags', function () {
    Http::swap(new Factory);
    Http::preventStrayRequests();
    Http::fake(['api.openai.com/*' => Http::response([
        'model' => 'flagged-test-snapshot',
        'results' => [['flagged' => true, 'categories' => ['harassment' => true]]],
    ])]);
    $this->actingAs($this->reader)->postJson('/news/'.$this->article->getKey().'/comment', ['content' => 'Saya mengkritik kebijakan, bukan orangnya.'])->assertCreated();
    $pending = Comment::latest('commentID')->first();
    expect($pending->status)->toBe('pending_review');
    $this->actingAs($this->admin)->postJson($this->base.'/'.$pending->getKey().'/feedback', [
        ...$this->payload, 'classification' => 'appropriate', 'category' => 'harmless_criticism', 'explanation' => null,
    ])->assertOk();
    expect($pending->fresh()->status)->toBe('published')
        ->and($pending->fresh()->ai_flagged)->toBeTrue()
        ->and(CommentModerationAssessment::where('comment_id', $pending->getKey())->first()->classification)->toBe('flagged')
        ->and(CommentModerationFeedback::first()->classification)->toBe('appropriate');
});

test('removed comments can be restored with a second append-only correction', function () {
    $this->actingAs($this->admin)->postJson($this->endpoint, $this->payload)->assertOk();
    $this->postJson($this->endpoint, [
        ...$this->payload, 'classification' => 'appropriate', 'category' => 'harmless_criticism',
        'expected_revision' => 1, 'request_id' => (string) Str::uuid(),
    ])->assertOk();
    expect($this->comment->fresh()->status)->toBe('published')
        ->and(CommentModerationFeedback::count())->toBe(2)
        ->and(CommentModerationAssessment::count())->toBe(1);
});

test('feedback cannot introduce unauthorized transitions', function (string $status, string $classification) {
    $this->comment->update(['status' => $status]);
    $this->actingAs($this->admin)->postJson($this->endpoint, [
        ...$this->payload, 'classification' => $classification,
        'category' => $classification === 'appropriate' ? 'harmless_criticism' : 'spam',
    ])->assertConflict();
    expect($this->comment->fresh()->status)->toBe($status)->and(CommentModerationFeedback::count())->toBe(0);
})->with([['rejected', 'appropriate'], ['published', 'appropriate'], ['pending_review', 'inappropriate'], ['removed', 'inappropriate']]);

test('hidden comments are scoped to the article and never appear in public props', function () {
    $this->comment->update(['status' => 'pending_review']);
    $other = News::factory()->create();
    Comment::create(['newsID' => $other->getKey(), 'content' => 'Private other article', 'status' => 'removed']);
    $this->actingAs($this->reader)->get('/news/'.$this->article->getKey())->assertInertia(fn (Assert $page) => $page
        ->component('newsdetails')->has('comments', 0)->where('canCorrectModeration', false)->missing('moderation_comments'));
    $this->actingAs($this->admin)->get('/news/'.$this->article->getKey())->assertInertia(fn (Assert $page) => $page
        ->has('comments', 0)->where('canCorrectModeration', true));
    $this->getJson($this->base)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.content', $this->comment->content)
        ->assertHeader('Cache-Control', 'no-store, private');
    $wrong = '/admin/news/'.$other->getKey().'/moderation-comments/'.$this->comment->getKey();
    $this->getJson($wrong)->assertNotFound();
    $this->postJson($wrong.'/feedback', $this->payload)->assertNotFound();
});

test('invalid feedback is rejected without mutation', function (array $changes) {
    $this->actingAs($this->admin)->postJson($this->endpoint, [...$this->payload, ...$changes])->assertUnprocessable();
    expect(CommentModerationFeedback::count())->toBe(0)->and($this->comment->fresh()->status)->toBe('published');
})->with([
    [['category' => '']], [['category' => 'harmless_criticism']], [['classification' => 'published']],
    [['expected_revision' => -1]], [['request_id' => 'invalid']], [['explanation' => str_repeat('x', 1001)]],
]);

test('original assessment metadata is captured once and cannot be edited through its model', function () {
    $assessment = CommentModerationAssessment::first();
    expect($assessment->requested_model)->toBe('omni-moderation-latest')
        ->and($assessment->returned_model)->toBe('moderation-test-snapshot')
        ->and($assessment->category_scores)->toBe(['harassment' => 0.01]);
    expect(fn () => $assessment->update(['classification' => 'flagged']))->toThrow(LogicException::class);
});

test('legacy comments get a truthful assessment snapshot without inventing model metadata', function () {
    $legacy = Comment::create(['newsID' => $this->article->getKey(), 'content' => 'Legacy', 'status' => 'published', 'ai_flagged' => false]);
    $this->actingAs($this->admin)->postJson($this->base.'/'.$legacy->getKey().'/feedback', $this->payload)->assertOk();
    $assessment = CommentModerationAssessment::where('comment_id', $legacy->getKey())->first();
    expect($assessment->source)->toBe('legacy_snapshot')->and($assessment->requested_model)->toBeNull()
        ->and($assessment->initial_status)->toBeNull()->and($assessment->classification)->toBe('not_flagged');
});

test('feedback insert failures roll back removal history and report resolution', function () {
    $this->postJson('/comments/'.$this->comment->getKey().'/report', ['reason' => 'Tinjau'])->assertOk();
    CommentModerationFeedback::creating(fn () => throw new RuntimeException('Simulated storage failure'));
    try {
        $this->actingAs($this->admin)->postJson($this->endpoint, $this->payload)->assertStatus(500);
        expect($this->comment->fresh()->status)->toBe('published')
            ->and(DB::table('comment_moderation_history')->whereNotNull('from_status')->count())->toBe(0)
            ->and(DB::table('comment_reports')->first()->resolved_at)->toBeNull();
    } finally {
        CommentModerationFeedback::flushEventListeners();
        CommentModerationFeedback::clearBootedModels();
    }
});
