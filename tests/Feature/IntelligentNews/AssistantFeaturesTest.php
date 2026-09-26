<?php

use App\Jobs\ProcessIntelligenceDocument;
use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsSession;
use App\Models\NewsCategory;
use App\Models\User;
use App\Models\UserRole;
use App\Services\NewsGenerationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

function assistantOwner()
{
    return User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
}
function assistantSession($user)
{
    return IntelligentNewsSession::create(['created_by' => $user->getKey(), 'status' => 'collecting_sources', 'selected_document_ids' => [], 'selected_information_ids' => [], 'user_facts' => [], 'pending_questions' => [], 'conflicts' => []]);
}
function assistantProposal($user)
{
    $session = assistantSession($user);
    $category = NewsCategory::firstOrCreate(['slug' => 'lainnya'], ['name' => 'Lainnya', 'status' => 'active']);
    $draft = IntelligentNewsDraft::create(['created_by' => $user->getKey(), 'headline' => 'Test', 'lead' => 'Lead', 'body' => ['Body'], 'summary' => 'Summary', 'labels' => [], 'sources_used' => [], 'warnings' => [], 'status' => 'draft', 'version' => 1, 'category_id' => $category->getKey()]);
    $message = $session->messages()->create(['role' => 'assistant', 'intent' => 'category_proposal', 'content' => 'Usulan kategori', 'payload' => ['category_proposal' => ['name' => 'Dinamika Penduduk', 'reason' => 'Fokus demografi desa.', 'status' => 'pending', 'draft_id' => $draft->id, 'draft_version' => 1]]]);

    return [$message, $draft];
}

test('category is created only by explicit approval and repeated approval is idempotent', function () {
    $user = assistantOwner();
    [$message, $draft] = assistantProposal($user);
    expect(NewsCategory::where('name', 'Dinamika Penduduk')->exists())->toBeFalse();
    $url = route('admin.assistant.category-decision', $message);
    $this->actingAs($user)->post($url, ['decision' => 'approve'])->assertRedirect();
    $this->post($url, ['decision' => 'approve'])->assertRedirect();
    expect(NewsCategory::where('name', 'Dinamika Penduduk')->count())->toBe(1);
    expect($draft->fresh()->category->name)->toBe('Dinamika Penduduk');
    expect($draft->fresh()->version)->toBe(2);
});

test('category decisions enforce owner scope and cancellation does not create a category', function () {
    $user = assistantOwner();
    [$message, $draft] = assistantProposal($user);
    $this->actingAs(assistantOwner())->post(route('admin.assistant.category-decision', $message), ['decision' => 'approve'])->assertForbidden();
    $this->actingAs($user)->post(route('admin.assistant.category-decision', $message), ['decision' => 'cancel'])->assertRedirect();
    expect(NewsCategory::where('name', 'Dinamika Penduduk')->exists())->toBeFalse();
    expect($draft->fresh()->version)->toBe(1);
});

test('approval reuses a case insensitive duplicate and existing choice never creates category', function () {
    $user = assistantOwner();
    [$message, $draft] = assistantProposal($user);
    $category = NewsCategory::create(['name' => 'DINAMIKA PENDUDUK', 'slug' => 'demography', 'status' => 'active']);
    $before = NewsCategory::count();
    $this->actingAs($user)->post(route('admin.assistant.category-decision', $message), ['decision' => 'approve'])->assertRedirect();
    expect(NewsCategory::count())->toBe($before);
    expect($draft->fresh()->category_id)->toBe($category->getKey());
    [$otherMessage, $otherDraft] = assistantProposal($user);
    $this->post(route('admin.assistant.category-decision', $otherMessage), ['decision' => 'existing', 'category_id' => $category->getKey()])->assertRedirect();
    expect(NewsCategory::count())->toBe($before);
    expect($otherDraft->fresh()->category_id)->toBe($category->getKey());
});

test('ordinary questions stay conversational and never call news generation', function () {
    $user = assistantOwner();
    $session = assistantSession($user);
    Http::fake(['*/assistant/respond' => Http::response(['intent' => 'question', 'answer' => 'Belum ada bukti. Lampirkan dokumen.', 'source_ids' => []])]);
    $result = app(NewsGenerationService::class)->generate($user->getKey(), ['mode' => 'auto', 'session_id' => $session->id, 'prompt' => 'Berapa penduduk desa?']);
    expect($result)->toHaveKey('url');
    expect($session->fresh()->current_intent)->toBe('question');
    expect(IntelligentNewsDraft::count())->toBe(0);
    Http::assertSentCount(1);
});

test('session panel is persistent and excludes other users sessions', function () {
    $user = assistantOwner();
    $own = assistantSession($user);
    assistantSession(assistantOwner());
    $this->actingAs($user)->get(route('admin.assistant.index'))->assertInertia(fn (AssertableInertia $page) => $page->has('sessions', 1)->where('sessions.0.id', $own->id));
});

test('save only upload stores file without extracting or generating', function () {
    Queue::fake();
    Storage::fake('local');
    config(['filesystems.default' => 'local']);
    $user = assistantOwner();
    $this->actingAs($user)->post(route('admin.documents.store'), ['origin' => 'assistant', 'intent' => 'store_document', 'documents' => [UploadedFile::fake()->createWithContent('facts.txt', 'Stored facts')]])->assertRedirect();
    Queue::assertNothingPushed();
    expect(IntelligenceDocument::first()->status)->toBe('ready');
    expect(IntelligenceInformation::count())->toBe(0);
    expect(IntelligentNewsSession::first()->current_intent)->toBe('store_document');
});

test('generated category proposal is saved without creating category', function () {
    $user = assistantOwner();
    $session = assistantSession($user);
    NewsCategory::firstOrCreate(['slug' => 'lainnya'], ['name' => 'Lainnya', 'status' => 'active']);
    Http::fake(['*/news/generate' => Http::response(['article' => ['headline' => 'Report', 'lead' => 'Lead', 'body' => ['Body'], 'summary' => 'Summary', 'labels' => [], 'sources_used' => [], 'warnings' => [], 'category' => 'Lainnya', 'category_proposal' => ['name' => 'New topic', 'reason' => 'A distinct editorial topic.']]])]);
    app(NewsGenerationService::class)->generate($user->getKey(), ['session_id' => $session->id, 'prompt' => 'Buat berita']);
    expect(NewsCategory::where('name', 'New topic')->exists())->toBeFalse();
    expect($session->messages()->where('intent', 'category_proposal')->first()->payload['category_proposal']['status'])->toBe('pending');
});

test('stored files can be explicitly extracted later', function () {
    Queue::fake();
    $user = assistantOwner();
    $session = assistantSession($user);
    $doc = IntelligenceDocument::create(['uploaded_by' => $user->getKey(), 'original_name' => 'facts.txt', 'storage_disk' => 'local', 'storage_path' => 'facts.txt', 'file_size' => 10, 'sha256' => str_repeat('b', 64), 'status' => 'ready']);
    $session->update(['selected_document_ids' => [$doc->id]]);
    Http::fake(['*/assistant/respond' => Http::response(['intent' => 'extract_information', 'answer' => 'Read the file.', 'source_ids' => []])]);
    app(NewsGenerationService::class)->generate($user->getKey(), ['session_id' => $session->id, 'mode' => 'auto', 'prompt' => 'Ekstrak dokumen tersimpan']);
    Queue::assertPushed(ProcessIntelligenceDocument::class);
    expect($session->fresh()->status)->toBe('processing_files');
    expect(IntelligentNewsDraft::count())->toBe(0);
});
