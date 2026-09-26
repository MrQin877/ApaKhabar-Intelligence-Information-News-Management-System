<?php

use App\Jobs\GenerateIntelligentNews;
use App\Jobs\ProcessIntelligenceDocument;
use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
use App\Models\IntelligentNewsMessage;
use App\Models\IntelligentNewsRun;
use App\Models\IntelligentNewsRunEvent;
use App\Models\IntelligentNewsSession;
use App\Models\NewsCategory;
use App\Models\User;
use App\Models\UserRole;
use App\Services\NewsGenerationService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;

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

test('submitted attachments preserve evidence snapshots after library edits', function () {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $source = approvedAgentSource($user);
    $other = User::factory()->create(['roleID' => $user->roleID]);
    $otherSource = approvedAgentSource($other);
    Http::fake(['*/news/generate' => Http::response([
        'run_id' => 'attachment-test', 'status' => 'awaiting_answers', 'article' => null,
        'completeness' => ['missing' => [], 'conflicts' => []],
    ])]);
    $this->actingAs($user)->post(route('admin.assistant.generate'), [
        'information_ids' => [$source->id, $otherSource->id], 'prompt' => 'Buat berita',
    ])->assertSessionHasNoErrors();
    $message = IntelligentNewsMessage::where('role', 'user')->firstOrFail();
    $snapshot = $message->payload['information_attachments'];
    expect($snapshot)->toHaveCount(1);
    expect($snapshot[0]['id'])->toBe($source->id);
    expect($snapshot[0]['document']['original_name'])->toBe('workshop.txt');
    expect($snapshot[0]['evidence'][0]['quote'])->toBe('Desa mengadakan lokakarya.');
    $source->update(['title' => 'Changed title', 'summary' => 'Changed summary', 'evidence' => []]);
    expect($message->fresh()->payload['information_attachments'])->toBe($snapshot);
    $this->get(route('admin.assistant.index', ['session' => $message->session_id]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('newsSession.messages.0.payload.information_attachments.0.title', 'Lokakarya')
            ->where('newsSession.messages.0.payload.information_attachments.0.evidence.0.quote', 'Desa mengadakan lokakarya.'));
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
    $session = IntelligentNewsSession::where('created_by', $user->getKey())->latest('id')->firstOrFail();
    $this->get(route('admin.assistant.index', ['session' => $session->id]))
        ->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
        ->component('admin/intelligentnewscreator/chat')
        ->where('generatedArticle.draft_id', $session->draft_id)
        ->where('generatedArticle.headline', 'Lokakarya Desa'));
    $other = User::factory()->create(['roleID' => $user->roleID]);
    $this->actingAs($other)->get(route('admin.assistant.index', ['session' => $session->id]))
        ->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
        ->where('newsSession', null)->where('generatedArticle', null));

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

test('background generation returns immediately and can be polled until saved', function () {
    config(['queue.default' => 'database']);
    Queue::fake();
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $source = approvedAgentSource($user);
    $id = (string) Str::uuid();
    Http::fake(['*/news/generate' => Http::response([
        'run_id' => $id, 'status' => 'awaiting_answers', 'article' => null,
        'completeness' => ['missing' => [['field' => 'location', 'importance' => 'required', 'question' => 'Di mana?']], 'conflicts' => []],
    ])]);
    $input = ['request_id' => $id, 'information_ids' => [$source->id], 'prompt' => 'Buat berita'];
    $this->actingAs($user)->postJson(route('admin.assistant.generate-async'), $input)->assertStatus(202);
    Http::assertNothingSent();
    $this->getJson(route('admin.assistant.progress', $id))->assertOk()->assertJsonPath('status', 'queued');
    $this->postJson(route('admin.assistant.generate-async'), $input)->assertStatus(202);
    Queue::assertPushed(GenerateIntelligentNews::class, 1);
    $job = new GenerateIntelligentNews($user->getKey(), $input);
    $job->handle(app(NewsGenerationService::class));
    $this->getJson(route('admin.assistant.progress', $id))->assertOk()->assertJsonPath('status', 'completed');
    expect(Cache::get($job::cacheKey($user->getKey(), $id))['url'])->toStartWith('/admin/ai-assistant?')->toContain('session=');
    $job->handle(app(NewsGenerationService::class));
    $this->assertDatabaseCount('intelligent_news_runs', 1);
});

test('background progress hides other owners and reports failed validation', function () {
    $owner = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $other = User::factory()->create(['roleID' => $owner->roleID]);
    $source = approvedAgentSource($owner);
    $source->update(['review_status' => 'pending']);
    $id = (string) Str::uuid();
    $job = new GenerateIntelligentNews($owner->getKey(), ['request_id' => $id, 'information_ids' => [$source->id], 'prompt' => 'Buat berita']);
    Http::fake();
    $job->handle(app(NewsGenerationService::class));
    $this->actingAs($owner)->getJson(route('admin.assistant.progress', $id))->assertOk()->assertJsonPath('status', 'failed');
    $this->actingAs($other)->getJson(route('admin.assistant.progress', $id))->assertNotFound();
    Http::assertNothingSent();
});

test('running background job exposes live model stages before completion', function () {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $id = (string) Str::uuid();
    Cache::put(GenerateIntelligentNews::cacheKey($user->getKey(), $id), ['status' => 'running']);
    $session = IntelligentNewsSession::create(['created_by' => $user->getKey(), 'status' => 'ready_to_generate', 'selected_document_ids' => [], 'selected_information_ids' => [], 'user_facts' => [], 'pending_questions' => [], 'conflicts' => []]);
    $run = IntelligentNewsRun::create(['session_id' => $session->id, 'intent' => 'generate_news', 'status' => 'running']);
    IntelligentNewsRunEvent::create([
        'run_id' => $run->id, 'sequence' => 1, 'event_type' => 'agent_run', 'label' => 'Started', 'content' => 'Started',
        'payload' => ['client_request_id' => $id, 'agent_run_id' => 'python-live'],
    ]);
    Http::fake(['*/agent/runs/python-live*' => Http::response([
        'status' => 'running', 'events' => [['sequence' => 1, 'event_type' => 'stage_started', 'label' => 'Menyusun draf']],
    ])]);
    $this->actingAs($user)->getJson(route('admin.assistant.progress', $id))->assertOk()
        ->assertJsonPath('status', 'running')->assertJsonPath('events.0.event_type', 'stage_started');
});

test('document progress is owner scoped and proxies actual chunk counts', function () {
    $owner = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $other = User::factory()->create(['roleID' => $owner->roleID]);
    $document = approvedAgentSource($owner)->document;
    $document->update(['status' => 'processing']);
    Cache::put('document-progress:'.$document->id, 'opaque-id');
    Http::fake(['*/documents/progress/opaque-id' => Http::response(['stage' => 'extracting', 'label' => 'Bagian 2 dari 3', 'completed_chunks' => 1, 'total_chunks' => 3])]);
    $this->actingAs($other)->getJson(route('admin.assistant.document-progress', $document))->assertForbidden();
    Http::assertNothingSent();
    $this->actingAs($owner)->getJson(route('admin.assistant.document-progress', $document))->assertOk()
        ->assertJsonPath('completed_chunks', 1)->assertJsonPath('total_chunks', 3);
});

test('successful empty extraction completes without repeated model requests', function () {
    Storage::fake('local');
    $owner = User::factory()->create();
    $document = approvedAgentSource($owner)->document;
    $document->update(['status' => 'processing']);
    Storage::disk('local')->put($document->storage_path, 'No relevant facts.');
    Http::fake(['*/documents/batch-extract' => Http::response(['results' => [[
        'status' => 'ready', 'document' => ['document_id' => 'empty', 'character_count' => 18],
        'extraction' => ['information' => []], 'chunks_indexed' => 0,
    ]]])]);
    (new ProcessIntelligenceDocument($document->id))->handle();
    expect($document->fresh()->status)->toBe('ready');
    expect($document->information()->count())->toBe(0);
    Http::assertSentCount(1);
});

test('assistant page includes selected processing documents for live progress', function () {
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $document = approvedAgentSource($user)->document;
    $document->update(['status' => 'processing']);
    $session = IntelligentNewsSession::create([
        'created_by' => $user->getKey(), 'status' => 'processing_files',
        'selected_document_ids' => [$document->id], 'selected_information_ids' => [],
        'user_facts' => [], 'pending_questions' => [], 'conflicts' => [],
    ]);
    $this->actingAs($user)->get(route('admin.assistant.index', ['session' => $session->id]))
        ->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
        ->component('admin/intelligentnewscreator/chat')->has('documents', 1)
        ->where('documents.0.id', $document->id)->where('documents.0.status', 'processing'));
});

test('reprocessing replaces soft deleted extraction items without duplicate keys', function () {
    Storage::fake('local');
    $owner = User::factory()->create();
    $old = approvedAgentSource($owner);
    $document = $old->document;
    $request = $document->extractionRequests()->create([
        'requested_by' => $owner->getKey(), 'mode' => 'general', 'status' => 'completed', 'keywords' => [],
    ]);
    $old->update(['extraction_request_id' => $request->id, 'reviewed_by' => $owner->getKey(), 'reviewed_at' => now()]);
    Storage::disk('local')->put($document->storage_path, 'Updated data');
    Http::fake(['*/documents/batch-extract' => Http::response(['results' => [[
        'status' => 'ready', 'document' => ['document_id' => 'updated', 'character_count' => 12],
        'extraction' => ['information' => [[
            'type' => 'Event', 'title' => 'Updated event', 'summary' => '1000 records, not verified people.',
            'fields' => ['attendance_record_count' => 1000],
            'evidence' => [['source' => 'rows=2-1001', 'quote' => 'Calculated from all rows']],
        ]]], 'chunks_indexed' => 0,
    ]]])]);
    $job = new ProcessIntelligenceDocument($document->id, $request->id);
    $job->handle();
    $job->handle();
    expect($document->information()->count())->toBe(1);
    expect($old->fresh()->title)->toBe('Updated event');
    expect($old->fresh()->review_status)->toBe('pending');
    expect($old->fresh()->reviewed_by)->toBeNull();
    expect($old->fresh()->deleted_at)->toBeNull();
    expect($old->fresh()->fields['attendance_record_count'])->toBe(1000);
    expect($request->fresh()->status)->toBe('completed');
});

test('generation rereads only selected owner approved original files', function () {
    Storage::fake('local');
    $owner = User::factory()->create();
    $source = approvedAgentSource($owner);
    $foreign = approvedAgentSource(User::factory()->create());
    Storage::disk('local')->put($source->document->storage_path, 'Original workshop facts.');
    $normalized = ['document_id' => 'original', 'filename' => 'workshop.txt', 'media_type' => 'text/plain',
        'character_count' => 24, 'elements' => [['element_type' => 'paragraph', 'content' => 'Original workshop facts.',
            'source' => ['filename' => 'workshop.txt', 'paragraph' => 1]]]];
    Http::fake([
        '*/documents/upload' => Http::response($normalized),
        '*/news/generate' => Http::response(['status' => 'insufficient_evidence', 'guidance' => 'Test complete.']),
    ]);
    app(NewsGenerationService::class)->generate($owner->getKey(), ['information_ids' => [$source->id, $foreign->id], 'prompt' => 'Buat berita']);
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/news/generate')
        && (array) $request['original_documents'] === [(string) $source->id => $normalized]);
    Http::assertSentCount(2);
});
