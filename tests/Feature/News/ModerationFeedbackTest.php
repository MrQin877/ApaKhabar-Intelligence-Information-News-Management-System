<?php

use App\Models\Comment;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->article = News::factory()->create();
    $this->admin = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $this->moderator = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'moderator'])->getKey()]);
    $this->reader = User::factory()->create();
    $this->comment = Comment::create([
        'newsID' => $this->article->getKey(), 'userID' => $this->reader->getKey(),
        'content' => 'Komentar terlihat', 'status' => 'published',
    ]);
    $this->flagUrl = '/admin/news/'.$this->article->getKey().'/moderation-comments/'.$this->comment->getKey().'/flag';
});

test('admin and moderator flags temporarily hide news comments and enter the queue once', function () {
    $this->actingAs($this->reader)->postJson($this->flagUrl, ['category' => 'spam'])->assertForbidden();
    $this->actingAs($this->admin)->postJson($this->flagUrl, ['category' => 'spam', 'explanation' => 'Tautan mencurigakan'])->assertOk();
    $this->postJson($this->flagUrl, ['category' => 'spam'])->assertOk();
    $this->actingAs($this->moderator)->postJson($this->flagUrl, ['category' => 'indirect_insult'])->assertOk();
    expect($this->comment->fresh()->status)->toBe('pending_review')
        ->and(DB::table('comment_flags')->count())->toBe(2);
    $this->get('/admin/comments')->assertInertia(fn (Assert $page) => $page
        ->has('comments.data', 1)->where('counts.pending', 1)
        ->where('comments.data.0.flags.0.moderator_name', $this->moderator->name));
});

test('allow resolves flags and reports with a recorded moderator and action', function () {
    $this->actingAs($this->reader)->postJson('/comments/'.$this->comment->getKey().'/report', [
        'category' => 'Spam', 'details' => 'Berulang',
    ])->assertOk();
    $this->actingAs($this->admin)->postJson($this->flagUrl, ['category' => 'spam'])->assertOk();
    $this->assertDatabaseHas('comment_reports', ['category' => 'Spam', 'explanation' => 'Berulang']);
    $this->actingAs($this->moderator)->postJson('/admin/comments/'.$this->comment->getKey().'/decision', [
        'action' => 'allow', 'reason' => 'Aman', 'expected_revision' => 0,
    ])->assertOk();
    expect($this->comment->fresh()->status)->toBe('published')
        ->and(DB::table('comment_flags')->whereNull('resolved_at')->count())->toBe(0)
        ->and(DB::table('comment_reports')->whereNull('resolved_at')->count())->toBe(0);
    $this->assertDatabaseHas('comment_moderation_history', [
        'comment_id' => $this->comment->getKey(), 'moderator_id' => $this->moderator->getKey(),
        'action' => 'allow', 'from_status' => 'pending_review', 'to_status' => 'published', 'reason' => 'Aman',
    ]);
});

test('archived feedback and decisions remain readable after the original comment is deleted', function () {
    $history = DB::table('comment_moderation_history')->insertGetId([
        'comment_id' => $this->comment->getKey(), 'moderator_id' => $this->admin->getKey(),
        'from_status' => 'pending_review', 'to_status' => 'published', 'reason' => 'approve: Old decision', 'created_at' => now(),
    ]);
    DB::table('archived_comment_moderation_assessments')->insert([
        'id' => 71,
        'comment_id' => $this->comment->getKey(), 'classification' => 'inappropriate',
        'source' => 'openai', 'initial_status' => 'published', 'created_at' => now(),
        'comment_snapshot' => json_encode(['content' => $this->comment->content]),
        'source_sha256' => str_repeat('a', 64), 'archived_at' => now(),
    ]);
    DB::table('archived_comment_moderation_feedback')->insert([
        'id' => 81, 'comment_id' => $this->comment->getKey(), 'history_id' => $history, 'assessment_id' => 71,
        'administrator_id' => $this->admin->getKey(), 'classification' => 'inappropriate',
        'category' => 'spam', 'explanation' => 'Old record', 'request_id' => (string) \Illuminate\Support\Str::uuid(),
        'verification_status' => 'pending', 'expected_revision' => 0, 'created_at' => now(),
        'comment_snapshot' => json_encode(['content' => $this->comment->content]),
        'history_snapshot' => json_encode(['from_status' => 'pending_review', 'to_status' => 'published']),
        'administrator_snapshot' => json_encode(['name' => $this->admin->name]),
        'source_sha256' => str_repeat('b', 64), 'archived_at' => now(),
    ]);
    $this->actingAs($this->admin)->get('/admin/comments?tab=history')->assertInertia(fn (Assert $page) => $page
        ->has('comments.data.0.feedback', 1)->where('comments.data.0.history.0.action', null));
    $commentId = $this->comment->getKey();
    $this->comment->delete();
    $this->get('/admin/comments/legacy-history?comment_id='.$commentId)->assertInertia(fn (Assert $page) => $page
        ->has('assessments.data', 1)
        ->where('assessments.data.0.comment_snapshot.content', 'Komentar terlihat')
        ->where('assessments.data.0.feedback.0.history_snapshot.to_status', 'published')
        ->where('assessments.data.0.feedback.0.administrator_snapshot.name', $this->admin->name));
    expect(DB::table('archived_comment_moderation_assessments')->count())->toBe(1)
        ->and(DB::table('archived_comment_moderation_feedback')->count())->toBe(1);
});
