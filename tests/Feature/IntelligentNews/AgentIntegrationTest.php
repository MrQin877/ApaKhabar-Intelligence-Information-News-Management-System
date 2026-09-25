<?php

use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
use App\Models\IntelligentNewsMessage;
use App\Models\IntelligentNewsRun;
use App\Models\IntelligentNewsRunEvent;
use App\Models\IntelligentNewsSession;
use App\Models\NewsCategory;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Support\Facades\Http;

function approvedAgentSource(User $user): IntelligenceInformation
{
    $document = IntelligenceDocument::create([
        'uploaded_by' => $user->getKey(), 'original_name' => 'workshop.txt',
        'storage_disk' => 'local', 'storage_path' => 'test/workshop.txt',
        'file_size' => 20, 'sha256' => str_repeat('a', 64), 'status' => 'ready',
    ]);

    return IntelligenceInformation::create([
        'document_id' => $document->id, 'item_index' => 0, 'type' => 'Announcement',
        'title' => 'Lokakarya', 'summary' => 'Desa mengadakan lokakarya.',
        'labels' => ['pendidikan'], 'fields' => ['organizer' => 'Desa'],
        'evidence' => [['source' => 'workshop.txt', 'quote' => 'Desa mengadakan lokakarya.']],
        'search_text' => 'Lokakarya', 'review_status' => 'approved', 'is_active' => true,
    ]);
}

test('agent request contains owner approved ids and persists real events', function () {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $source = approvedAgentSource($user);
    Http::fake(['*/news/generate' => Http::response([
        'run_id' => 'agent-test', 'status' => 'awaiting_answers', 'article' => null,
        'completeness' => ['missing' => [['field' => 'location', 'importance' => 'required', 'question' => 'Di mana?']], 'conflicts' => []],
        'events' => [['event_type' => 'planning', 'label' => 'Rencana dibuat', 'payload' => ['steps' => []]]],
    ])]);
    $this->actingAs($user)->post(route('admin.assistant.generate'), [
        'information_ids' => [$source->id], 'prompt' => 'Buat berita',
    ])->assertSessionHasNoErrors()->assertRedirect();
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/news/generate')
        && $request['owner_id'] === (string) $user->getKey()
        && $request['eligible_information_ids'] === [(string) $source->id]
        && $request['information']['information'][0]['information_id'] === (string) $source->id);
    $this->assertDatabaseHas('intelligent_news_run_events', ['event_type' => 'planning', 'label' => 'Rencana dibuat']);
    expect(IntelligentNewsMessage::where('role', 'assistant')->first()->payload['agent_run_id'])->toBe('agent-test');
});

test('clarification resumes the persisted agent run with refreshed eligibility', function () {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $source = approvedAgentSource($user);
    $session = IntelligentNewsSession::create([
        'created_by' => $user->getKey(), 'status' => 'awaiting_answers', 'prompt' => 'Buat berita',
        'selected_information_ids' => [$source->id], 'selected_document_ids' => [],
        'user_facts' => [], 'pending_questions' => [], 'conflicts' => [],
    ]);
    IntelligentNewsMessage::create([
        'session_id' => $session->id, 'role' => 'assistant', 'intent' => 'clarification',
        'content' => 'Di mana?', 'payload' => ['agent_run_id' => 'persisted-run'],
    ]);
    Http::fake(['*/agent/runs/persisted-run/resume' => Http::response([
        'run_id' => 'persisted-run', 'status' => 'insufficient_evidence', 'guidance' => 'Bukti belum cukup.',
    ])]);
    $this->actingAs($user)->post(route('admin.assistant.generate'), [
        'session_id' => $session->id, 'answers' => ['location' => 'Balai desa'],
    ])->assertSessionHasErrors('guidance');
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/agent/runs/persisted-run/resume')
        && $request['eligible_information_ids'] === [(string) $source->id]
        && $request['answers'] === [['field' => 'location', 'value' => 'Balai desa']]);
    expect($session->fresh()->clarification_rounds)->toBe(1);
});

test('pending information cannot enter agent generation', function () {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $source = approvedAgentSource($user);
    $source->update(['review_status' => 'pending']);
    Http::fake();
    $this->actingAs($user)->post(route('admin.assistant.generate'), [
        'information_ids' => [$source->id], 'prompt' => 'Buat berita',
    ])->assertSessionHasErrors('generation');
    Http::assertNothingSent();
});

test('web source decisions do not consume the factual clarification round', function () {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $session = IntelligentNewsSession::create([
        'created_by' => $user->getKey(), 'status' => 'awaiting_answers', 'prompt' => 'Buat berita',
        'selected_information_ids' => [], 'selected_document_ids' => [], 'user_facts' => [],
        'pending_questions' => [], 'conflicts' => [],
    ]);
    IntelligentNewsMessage::create([
        'session_id' => $session->id, 'role' => 'assistant', 'intent' => 'clarification',
        'content' => 'Setujui sumber?', 'payload' => ['agent_run_id' => 'web-run'],
    ]);
    Http::fake(['*/agent/runs/web-run/resume' => Http::response([
        'run_id' => 'web-run', 'status' => 'awaiting_answers', 'article' => null,
        'completeness' => ['missing' => [['field' => 'location', 'importance' => 'required', 'question' => 'Di mana?']], 'conflicts' => []],
    ])]);
    $this->actingAs($user)->post(route('admin.assistant.generate'), [
        'session_id' => $session->id, 'answers' => ['web_source:web:one' => 'Setujui'],
    ])->assertSessionHasNoErrors();
    Http::assertSent(fn ($request) => $request['approved_web_source_ids'] === ['web:one'] && $request['answers'] === []);
    expect($session->fresh()->clarification_rounds)->toBe(0);
    expect($session->fresh()->user_facts)->toBe([]);
});

test('progress proxy denies another users run', function () {
    $owner = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $other = User::factory()->create(['roleID' => $owner->roleID]);
    $session = IntelligentNewsSession::create(['created_by' => $owner->getKey(), 'status' => 'ready_to_generate', 'selected_document_ids' => [], 'selected_information_ids' => [], 'user_facts' => [], 'pending_questions' => [], 'conflicts' => []]);
    $run = IntelligentNewsRun::create(['session_id' => $session->id, 'intent' => 'generate_news', 'status' => 'running']);
    IntelligentNewsRunEvent::create([
        'run_id' => $run->id, 'sequence' => 1, 'event_type' => 'agent_run', 'label' => 'Started', 'content' => 'Started',
        'payload' => ['client_request_id' => 'private-run', 'agent_run_id' => 'python-run'],
    ]);
    Http::fake();
    $this->actingAs($other)->getJson(route('admin.assistant.progress', 'private-run'))->assertNotFound();
    Http::assertNothingSent();
});

test('completed agent result saves a draft version and quality report', function () {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $source = approvedAgentSource($user);
    NewsCategory::firstOrCreate(['name' => 'Pendidikan'], ['slug' => 'pendidikan', 'status' => 'active', 'is_default' => true]);
    Http::fake(['*/news/generate' => Http::response([
        'run_id' => 'complete-run', 'status' => 'completed',
        'article' => ['headline' => 'Lokakarya Desa', 'subheadline' => null, 'lead' => 'Desa mengadakan lokakarya.',
            'body' => ['Desa mengadakan lokakarya.'], 'summary' => 'Lokakarya desa.', 'labels' => ['pendidikan'],
            'category' => 'Pendidikan', 'sources_used' => ['information:'.$source->id], 'warnings' => []],
        'quality' => ['quality_score' => 90, 'quality_label' => 'good', 'publish_blocked' => false],
        'skills_used' => [['name' => 'editorial-review', 'version' => 'test-hash']],
    ])]);
    $this->actingAs($user)->post(route('admin.assistant.generate'), [
        'information_ids' => [$source->id], 'prompt' => 'Buat berita',
    ])->assertSessionHasNoErrors();
    $this->assertDatabaseHas('intelligent_news_drafts', ['headline' => 'Lokakarya Desa', 'status' => 'draft', 'version' => 1]);
    $this->assertDatabaseCount('intelligent_news_draft_versions', 1);
    $this->assertDatabaseHas('ai_quality_evaluations', ['overall_score' => 90]);
});

test('reindex command excludes archived and pending records', function () {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $approved = approvedAgentSource($user);
    $pending = approvedAgentSource($user);
    $pending->update(['review_status' => 'pending']);
    $archived = approvedAgentSource($user);
    $archived->document->update(['archived_at' => now()]);
    Http::fake(['*/rag/information/index' => Http::response(['indexed' => 1])]);
    $this->artisan('ai:reindex-approved', ['--owner' => $user->getKey()])->assertSuccessful();
    Http::assertSent(fn ($request) => count($request['items']) === 1
        && $request['items'][0]['information_id'] === (string) $approved->id
        && $request['items'][0]['review_status'] === 'approved');
});
