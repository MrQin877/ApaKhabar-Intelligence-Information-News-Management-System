<?php

use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsSession;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->owner = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $this->actingAs($this->owner);
    $this->draft = IntelligentNewsDraft::create(['created_by' => $this->owner->getKey(), 'title' => 'Unfinished article', 'content' => 'Draft content', 'excerpt' => '', 'labels' => [], 'sources_used' => [], 'warnings' => [], 'status' => 'draft', 'creation_method' => 'manual']);
});

test('deleting a draft hides it and its conversation while preserving recoverable records', function () {
    $session = IntelligentNewsSession::create(['selected_document_ids' => [], 'selected_information_ids' => [], 'user_facts' => [], 'pending_questions' => [], 'conflicts' => [], 'created_by' => $this->owner->getKey(), 'draft_id' => $this->draft->id, 'status' => 'draft_generated']);
    $this->delete('/admin/news/draft/'.$this->draft->id)->assertRedirect();
    $this->assertSoftDeleted('intelligent_news_drafts', ['id' => $this->draft->id]);
    $this->assertSoftDeleted('intelligent_news_sessions', ['id' => $session->id]);
    $this->get('/admin/news')->assertInertia(fn (Assert $page) => $page->has('items', 0)->where('counts.draft', 0));
    $this->get('/admin/news/manual/'.$this->draft->id.'/edit')->assertNotFound();
});

test('unpublished sessions can be deleted without creating a draft', function () {
    $session = IntelligentNewsSession::create(['selected_document_ids' => [], 'selected_information_ids' => [], 'user_facts' => [], 'pending_questions' => [], 'conflicts' => [], 'created_by' => $this->owner->getKey(), 'status' => 'collecting_sources', 'current_intent' => 'generate_news']);
    $this->delete('/admin/news/session/'.$session->id)->assertRedirect();
    $this->assertSoftDeleted('intelligent_news_sessions', ['id' => $session->id]);
});

test('successful publications cannot be deleted as drafts', function (array $attributes) {
    $this->draft->update($attributes);
    $this->deleteJson('/admin/news/draft/'.$this->draft->id)->assertUnprocessable();
    expect($this->draft->fresh()->deleted_at)->toBeNull();
})->with([
    [['instagram_media_id' => 'published-instagram']],
    [['facebook_post_id' => 'published-facebook']],
    [['publication_results' => ['application' => ['success' => true]]]],
    [['status' => 'published']],
]);

test('failed-only publication remains a deletable draft', function () {
    $this->draft->update(['publication_results' => ['instagram' => ['success' => false]]]);
    $this->get('/admin/news')->assertInertia(fn (Assert $page) => $page->where('items.0.status', 'draft')->where('items.0.can_delete', true));
    $this->delete('/admin/news/draft/'.$this->draft->id)->assertRedirect();
    $this->assertSoftDeleted('intelligent_news_drafts', ['id' => $this->draft->id]);
});

test('draft deletion enforces ownership and blocks running work', function () {
    $other = User::factory()->create(['roleID' => $this->owner->roleID]);
    $this->actingAs($other)->deleteJson('/admin/news/draft/'.$this->draft->id)->assertForbidden();
    $this->actingAs($this->owner);
    $session = IntelligentNewsSession::create(['selected_document_ids' => [], 'selected_information_ids' => [], 'user_facts' => [], 'pending_questions' => [], 'conflicts' => [], 'created_by' => $this->owner->getKey(), 'draft_id' => $this->draft->id, 'status' => 'processing_files']);
    $this->deleteJson('/admin/news/draft/'.$this->draft->id)->assertUnprocessable();
    expect($this->draft->fresh()->deleted_at)->toBeNull()->and($session->fresh()->deleted_at)->toBeNull();
});

test('archive is reserved for published content and news can be restored', function () {
    $this->postJson('/admin/news/draft/'.$this->draft->id.'/archive')->assertUnprocessable();
    $news = News::factory()->create(['status' => 'active']);
    $this->post('/admin/news/news/'.$news->getKey().'/archive')->assertRedirect();
    expect($news->fresh()->status)->toBe('archived');
    $this->get('/news/'.$news->getKey())->assertNotFound();
    $this->post('/admin/news/news/'.$news->getKey().'/restore')->assertRedirect();
    expect($news->fresh()->status)->toBe('active');
    $this->get('/news/'.$news->getKey())->assertOk();
});
