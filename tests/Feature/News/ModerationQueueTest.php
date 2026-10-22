<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Comment;
use App\Models\CommentModerationAssessment;
use App\Models\CommentModerationFeedback;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use App\Services\News\ModerationFeedbackService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $this->article = News::factory()->create(['title' => 'Berita pengujian moderasi']);
    $this->actingAs($this->admin);
});

function queueComment($test, array $attributes = []): Comment
{
    return Comment::create(array_merge([
        'newsID' => $test->article->getKey(), 'userID' => null,
        'guest_name' => 'Tamu uji', 'content' => 'Komentar asli', 'status' => 'pending_review',
        'ai_flagged' => true, 'moderation_categories' => ['harassment' => true], 'moderation_reason' => 'ai_flagged',
    ], $attributes));
}

function flagQueueComment($test, Comment $comment): void
{
    app(ModerationFeedbackService::class)->submit($test->admin, (string) $comment->newsID, (string) $comment->getKey(), [
        'classification' => 'inappropriate', 'category' => 'indirect_insult', 'explanation' => 'Konteks hinaan tersirat.',
        'expected_revision' => 0, 'request_id' => (string) Str::uuid(),
    ]);
}

test('pending queue excludes ordinary published comments and deduplicates multiple sources', function () {
    queueComment($this, ['status' => 'published', 'ai_flagged' => false]);
    $ai = queueComment($this);
    $reported = queueComment($this, ['status' => 'published', 'ai_flagged' => false]);
    $flagged = queueComment($this, ['status' => 'published']);
    flagQueueComment($this, $flagged);
    foreach ([$reported, $flagged] as $comment) {
        foreach ([User::factory()->create(), User::factory()->create()] as $user) {
            DB::table('comment_reports')->insert(['comment_id' => $comment->getKey(), 'user_id' => $user->getKey(), 'reason' => 'Spam', 'created_at' => now()]);
        }
    }
    $this->get('/admin/comments')->assertInertia(fn (Assert $page) => $page->has('comments.data', 3)->where('counts.pending', 3)->where('counts.ai', 2)->where('counts.reported', 2)->where('counts.admin', 1));
    foreach (['ai' => 2, 'reported' => 2, 'admin' => 1] as $source => $count) {
        $this->get('/admin/comments?source='.$source)->assertInertia(fn (Assert $page) => $page->has('comments.data', $count));
    }
    $this->get('/admin/comments?tab=history')->assertInertia(fn (Assert $page) => $page->has('comments.data', 0));
});

test('approving reported comments keeps them visible resolves reports and rejects duplicate decisions', function () {
    $comment = queueComment($this, ['status' => 'published']);
    DB::table('comment_reports')->insert(['comment_id' => $comment->getKey(), 'user_id' => $this->admin->getKey(), 'reason' => 'Tinjau', 'created_at' => now()]);
    $url = '/admin/comments/'.$comment->getKey().'/decision';
    $this->postJson($url, ['action' => 'dismiss_reports', 'expected_revision' => 0])->assertOk();
    $this->postJson($url, ['action' => 'dismiss_reports', 'expected_revision' => 0])->assertConflict();
    expect($comment->fresh()->status)->toBe('published');
    expect(DB::table('comment_reports')->value('resolved_at'))->not->toBeNull();
    $this->get('/admin/comments')->assertInertia(fn (Assert $page) => $page->has('comments.data', 0));
    $this->get('/admin/comments?tab=history&decision=approved')->assertInertia(fn (Assert $page) => $page->has('comments.data', 1)->has('comments.data.0.history', 1));
});

test('admin flags can be rejected and restored without overwriting feedback or prior history', function () {
    $comment = queueComment($this, ['status' => 'published']);
    flagQueueComment($this, $comment);
    $feedback = CommentModerationFeedback::first()->getAttributes();
    $assessment = CommentModerationAssessment::first()->getAttributes();
    $url = '/admin/comments/'.$comment->getKey().'/decision';
    $this->postJson($url, ['action' => 'reject', 'reason' => 'Ditolak setelah ditinjau', 'expected_revision' => 1])->assertOk();
    $this->get('/admin/comments')->assertInertia(fn (Assert $page) => $page->has('comments.data', 0));
    $this->get('/admin/comments?tab=history&decision=rejected')->assertInertia(fn (Assert $page) => $page->has('comments.data', 1)->has('comments.data.0.feedback', 1));
    $this->postJson($url, ['action' => 'restore', 'reason' => 'Banding diterima', 'expected_revision' => 2])->assertOk();
    $this->postJson($url, ['action' => 'restore', 'expected_revision' => 2])->assertConflict();
    expect($comment->fresh()->content)->toBe('Komentar asli')->and($comment->fresh()->status)->toBe('published')
        ->and(CommentModerationFeedback::first()->getAttributes())->toBe($feedback)
        ->and(CommentModerationAssessment::first()->getAttributes())->toBe($assessment)
        ->and(DB::table('comment_moderation_history')->count())->toBe(3);
    $this->get('/admin/comments?tab=history&decision=restored')->assertInertia(fn (Assert $page) => $page->has('comments.data', 1)->where('comments.data.0.history.0.moderator_name', $this->admin->name));
    $this->get('/admin/comments?tab=history&decision=rejected')->assertInertia(fn (Assert $page) => $page->has('comments.data', 0));
});

test('pending approval and rejection move into history and preserve original content', function (string $action, string $status) {
    $comment = queueComment($this);
    $this->postJson('/admin/comments/'.$comment->getKey().'/decision', ['action' => $action, 'expected_revision' => 0])->assertOk();
    expect($comment->fresh()->status)->toBe($status)->and($comment->fresh()->content)->toBe('Komentar asli');
    $this->get('/admin/comments')->assertInertia(fn (Assert $page) => $page->has('comments.data', 0));
    $this->get('/admin/comments?tab=history')->assertInertia(fn (Assert $page) => $page->has('comments.data', 1));
})->with([['approve', 'published'], ['reject', 'rejected']]);

test('history filters use latest decision date and support one-sided date ranges', function () {
    $comment = queueComment($this, ['guest_name' => 'Nama unik']);
    $this->travelTo(now()->setDate(2026, 10, 1));
    $url = '/admin/comments/'.$comment->getKey().'/decision';
    $this->postJson($url, ['action' => 'reject'])->assertOk();
    $this->travelTo(now()->setDate(2026, 10, 20));
    $this->postJson($url, ['action' => 'restore'])->assertOk();
    foreach (['search=Nama%20unik', 'search=Berita%20pengujian', 'search=Komentar%20asli', 'from=2026-10-20&until=2026-10-20', 'until=2026-10-21'] as $filter) {
        $this->get('/admin/comments?tab=history&'.$filter)->assertInertia(fn (Assert $page) => $page->has('comments.data', 1));
    }
    $this->get('/admin/comments?tab=history&until=2026-10-10')->assertInertia(fn (Assert $page) => $page->has('comments.data', 0));
    $this->get('/admin/comments?tab=history&search=TidakAda')->assertInertia(fn (Assert $page) => $page->has('comments.data', 0));
    $this->getJson('/admin/comments?from=2026-10-20&until=2026-10-01')->assertUnprocessable();
    $this->travelBack();
});

test('moderation lists paginate on the server without duplicate records', function () {
    for ($i = 0; $i < 23; $i++) {
        queueComment($this, ['guest_name' => 'Paginated']);
    }
    $this->get('/admin/comments?search=Paginated')->assertInertia(fn (Assert $page) => $page->has('comments.data', 20)->where('comments.total', 23)->where('comments.last_page', 2));
    $this->get('/admin/comments?search=Paginated&page=2')->assertInertia(fn (Assert $page) => $page->has('comments.data', 3)->where('comments.current_page', 2));
});

test('non-admin users cannot read the private queue or make decisions', function () {
    $comment = queueComment($this);
    $this->actingAs(User::factory()->create());
    $this->get('/admin/comments')->assertRedirect('/');
    $this->postJson('/admin/comments/'.$comment->getKey().'/decision', ['action' => 'approve'])->assertRedirect('/');
    expect($comment->fresh()->status)->toBe('pending_review');
});

test('shared pending indicator reflects every unresolved source and clears after decisions', function () {
    $ai = queueComment($this);
    $reported = queueComment($this, ['status' => 'published', 'ai_flagged' => false]);
    $flagged = queueComment($this, ['status' => 'published', 'ai_flagged' => false]);
    flagQueueComment($this, $flagged);
    foreach ([$this->admin, User::factory()->create()] as $reporter) {
        DB::table('comment_reports')->insert(['comment_id' => $reported->getKey(), 'user_id' => $reporter->getKey(), 'reason' => 'Spam', 'created_at' => now()]);
    }
    $this->get('/admin/comments')->assertInertia(fn (Assert $page) => $page->where('moderationPendingCount', 3));
    $this->postJson('/admin/comments/'.$ai->getKey().'/decision', ['action' => 'approve', 'reason' => 'Diizinkan', 'expected_revision' => 0])->assertOk();
    $this->postJson('/admin/comments/'.$reported->getKey().'/decision', ['action' => 'remove', 'reason' => 'Disembunyikan', 'expected_revision' => 0])->assertOk();
    $this->postJson('/admin/comments/'.$flagged->getKey().'/decision', ['action' => 'reject', 'expected_revision' => 1])->assertOk();
    $this->get('/admin/comments')->assertInertia(fn (Assert $page) => $page->where('moderationPendingCount', 0)->where('counts.pending', 0));
    expect(Comment::count())->toBe(3)->and($ai->fresh()->status)->toBe('published')->and($reported->fresh()->status)->toBe('removed');
    $this->assertDatabaseHas('comment_moderation_history', ['comment_id' => $reported->getKey(), 'moderator_id' => $this->admin->getKey(), 'reason' => 'remove: Disembunyikan']);
    queueComment($this);
    $this->get('/admin/comments', ['X-Inertia' => 'true', 'X-Inertia-Version' => app(HandleInertiaRequests::class)->version(Request::create('/admin/comments')), 'X-Inertia-Partial-Component' => 'admin/comments', 'X-Inertia-Partial-Data' => 'moderationPendingCount'])
        ->assertOk()->assertJsonPath('props.moderationPendingCount', 1)->assertJsonMissingPath('props.comments');
});

test('moderation counts are hidden from ordinary readers', function () {
    queueComment($this);
    $this->actingAs(User::factory()->create());
    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('moderationPendingCount', 0));
});
