<?php

// ================================================================
// ApaKhabar — Module: Create Intelligent News Content (Laravel)
// File: tests/Feature/IntelligentNews/IntelligentNewsValidationTest.php
//
// Run with:
//   php artisan test tests/Feature/IntelligentNews/IntelligentNewsValidationTest.php
//
// Positive Test Cases : TC-INC-01 to TC-INC-09
// Negative Test Cases : TC-INC-10 to TC-INC-18
// ================================================================

use App\Jobs\ProcessIntelligenceDocument;
use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsSession;
use App\Models\NewsCategory;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
    Queue::fake();

    $adminRole = UserRole::firstOrCreate(['name' => 'admin']);
    $villagerRole = UserRole::firstOrCreate(['name' => 'villager']);

    $this->admin = User::factory()->create(['roleID' => $adminRole->getKey()]);
    $this->villager = User::factory()->create(['roleID' => $villagerRole->getKey()]);
    $this->category = NewsCategory::firstOrCreate(
        ['name' => 'Kegiatan Desa'],
        ['slug' => 'kegiatan-desa', 'is_active' => true]
    );
});

function createDocumentAndInfoFor(User $user, string $reviewStatus = 'pending'): array
{
    $document = IntelligenceDocument::create([
        'uploaded_by' => $user->getKey(),
        'original_name' => 'notulen-rapat.txt',
        'storage_disk' => 'local',
        'storage_path' => 'intelligence-documents/notulen-rapat.txt',
        'mime_type' => 'text/plain',
        'file_size' => 128,
        'sha256' => hash('sha256', 'notulen-rapat'),
        'status' => 'ready',
        'embedding_status' => 'ready',
    ]);

    $information = IntelligenceInformation::create([
        'document_id' => $document->id,
        'item_index' => 0,
        'type' => 'Announcement',
        'title' => 'Gotong Royong Desa',
        'summary' => 'Warga akan mengadakan gotong royong membersihkan saluran air pada hari Minggu.',
        'labels' => ['lingkungan'],
        'fields' => ['organizer' => 'Pemerintah Desa'],
        'evidence' => [['source' => 'notulen-rapat.txt', 'quote' => 'Gotong royong hari Minggu.']],
        'search_text' => 'Gotong Royong Desa',
        'review_status' => $reviewStatus,
        'is_active' => $reviewStatus === 'approved',
    ]);

    return [$document, $information];
}

// ================================================================
// POSITIVE TEST CASES
// ================================================================

test('TC-INC-01: admin can view ai assistant page', function () {
    $this->actingAs($this->admin)
        ->get(route('admin.assistant.index'))
        ->assertStatus(200);
});

test('TC-INC-02: admin can view document library page', function () {
    $this->actingAs($this->admin)
        ->get(route('admin.documents.index'))
        ->assertStatus(200);
});

test('TC-INC-03: admin can upload a valid document for extraction', function () {
    $file = UploadedFile::fake()->createWithContent('laporan-desa.txt', 'Laporan kegiatan desa bulan ini.');

    $response = $this->actingAs($this->admin)
        ->post(route('admin.documents.store'), [
            'origin' => 'library',
            'documents' => [$file],
            'extraction_mode' => 'general',
        ]);

    $response->assertSessionHasNoErrors()->assertRedirect();
    $this->assertDatabaseHas('intelligence_documents', [
        'uploaded_by' => $this->admin->getKey(),
        'original_name' => 'laporan-desa.txt',
        'status' => 'processing',
    ]);
    Queue::assertPushedOn('documents', ProcessIntelligenceDocument::class);
});

test('TC-INC-04: admin can approve extracted intelligence information', function () {
    [, $information] = createDocumentAndInfoFor($this->admin, 'pending');
    Http::fake(['*/rag/information/index' => Http::response(['indexed' => 1], 200)]);

    $response = $this->actingAs($this->admin)
        ->post(route('admin.information.review', $information), [
            'decision' => 'approved',
        ]);

    $response->assertSessionHasNoErrors()->assertRedirect();
    $this->assertDatabaseHas('intelligence_information', [
        'id' => $information->id,
        'review_status' => 'approved',
        'is_active' => true,
    ]);
});

test('TC-INC-05: admin can reject extracted intelligence information', function () {
    [, $information] = createDocumentAndInfoFor($this->admin, 'pending');
    Http::fake(['*/rag/information/*' => Http::response(['deleted' => true], 200)]);

    $response = $this->actingAs($this->admin)
        ->post(route('admin.information.review', $information), [
            'decision' => 'rejected',
        ]);

    $response->assertSessionHasNoErrors()->assertRedirect();
    $this->assertSoftDeleted('intelligence_information', ['id' => $information->id]);
});

test('TC-INC-06: admin can generate intelligent news with approved information and prompt', function () {
    [, $information] = createDocumentAndInfoFor($this->admin, 'approved');

    Http::fake(['*/news/generate' => Http::response([
        'run_id' => 'run-inc-06',
        'status' => 'awaiting_answers',
        'article' => null,
        'completeness' => [
            'missing' => [['field' => 'time', 'importance' => 'required', 'question' => 'Jam berapa dimulai?']],
            'conflicts' => [],
        ],
        'events' => [
            ['event_type' => 'planning', 'label' => 'Menyusun rencana berita', 'payload' => []],
        ],
    ])]);

    $response = $this->actingAs($this->admin)
        ->post(route('admin.assistant.generate'), [
            'information_ids' => [$information->id],
            'prompt' => 'Buatkan berita gotong royong desa',
        ]);

    $response->assertSessionHasNoErrors()->assertRedirect();
    $this->assertDatabaseHas('intelligent_news_run_events', [
        'event_type' => 'planning',
        'label' => 'Menyusun rencana berita',
    ]);
});

test('TC-INC-07: admin can submit clarification answers to resume agent workflow', function () {
    [, $information] = createDocumentAndInfoFor($this->admin, 'approved');
    $session = IntelligentNewsSession::create([
        'created_by' => $this->admin->getKey(),
        'status' => 'awaiting_answers',
        'prompt' => 'Buatkan berita gotong royong',
        'selected_information_ids' => [$information->id],
        'selected_document_ids' => [],
        'user_facts' => [],
        'pending_questions' => [],
        'conflicts' => [],
    ]);
    $session->messages()->create([
        'role' => 'assistant',
        'intent' => 'clarification',
        'content' => 'Jam berapa dimulai?',
        'payload' => ['agent_run_id' => 'run-inc-07'],
    ]);

    Http::fake(['*/agent/runs/run-inc-07/resume' => Http::response([
        'run_id' => 'run-inc-07',
        'status' => 'completed',
        'completeness' => ['status' => 'ready', 'missing' => [], 'conflicts' => [], 'known_facts' => []],
        'article' => [
            'headline' => 'Gotong Royong Dimulai Pukul 07:00 WIB',
            'subheadline' => null,
            'lead' => 'Kegiatan gotong royong dimulai pukul 07:00 WIB.',
            'body' => ['Warga berkumpul sejak pagi.'],
            'summary' => 'Gotong royong desa.',
            'labels' => ['lingkungan'],
            'language' => 'id',
            'sources_used' => ['info:1'],
            'warnings' => [],
        ],
    ])]);

    $response = $this->actingAs($this->admin)
        ->post(route('admin.assistant.generate'), [
            'session_id' => $session->id,
            'answers' => ['time' => '07:00 WIB'],
        ]);

    $response->assertSessionHasNoErrors()->assertRedirect();
    Http::assertSent(fn ($req) => str_ends_with($req->url(), '/agent/runs/run-inc-07/resume'));
});

test('TC-INC-08: admin can update an ai generated draft with valid fields', function () {
    $draft = IntelligentNewsDraft::create([
        'created_by' => $this->admin->getKey(),
        'creation_method' => 'ai',
        'status' => 'draft',
        'version' => 1,
        'title' => 'Judul Awal',
        'excerpt' => 'Ringkasan awal berita.',
        'headline' => 'Judul Awal',
        'lead' => 'Lead awal berita.',
        'body' => ['Paragraf pertama.'],
        'labels' => ['lingkungan'],
        'sources_used' => ['info:1'],
        'warnings' => [],
        'category_id' => $this->category->getKey(),
    ]);

    $response = $this->actingAs($this->admin)
        ->put(route('admin.assistant.drafts.update', $draft), [
            'headline' => 'Gotong Royong Bersihkan Saluran Air',
            'subheadline' => 'Warga Antusias Hadir Sejak Pagi',
            'lead' => 'Warga desa melaksanakan gotong royong pada hari Minggu.',
            'body' => ['Kegiatan dimulai pukul 07:00 WIB di balai desa.'],
            'category_id' => $this->category->getKey(),
        ]);

    $response->assertSessionHasNoErrors()->assertRedirect();
    $fresh = $draft->fresh();
    expect($fresh->headline)->toBe('Gotong Royong Bersihkan Saluran Air');
    expect($fresh->version)->toBe(2);
});

test('TC-INC-09: admin can archive and restore a document', function () {
    [$document] = createDocumentAndInfoFor($this->admin, 'approved');

    $this->actingAs($this->admin)
        ->post(route('admin.documents.archive', $document))
        ->assertRedirect();
    expect($document->fresh()->archived_at)->not->toBeNull();

    $this->actingAs($this->admin)
        ->post(route('admin.documents.restore', $document))
        ->assertRedirect();
    expect($document->fresh()->archived_at)->toBeNull();
});

// ================================================================
// NEGATIVE TEST CASES
// ================================================================

test('TC-INC-10: document upload fails when documents field is empty', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.documents.store'), [
            'origin' => 'library',
            'documents' => [],
        ])
        ->assertSessionHasErrors('documents');
});

test('TC-INC-11: document upload fails for unsupported file type', function () {
    $badFile = UploadedFile::fake()->create('malware.exe', 100, 'application/octet-stream');

    $this->actingAs($this->admin)
        ->post(route('admin.documents.store'), [
            'origin' => 'library',
            'documents' => [$badFile],
        ])
        ->assertSessionHasErrors('documents.0');
});

test('TC-INC-12: targeted extraction fails when extraction query is missing', function () {
    $file = UploadedFile::fake()->createWithContent('data.txt', 'Isi dokumen.');

    $this->actingAs($this->admin)
        ->post(route('admin.documents.store'), [
            'origin' => 'library',
            'documents' => [$file],
            'extraction_mode' => 'targeted',
            'extraction_query' => '',
        ])
        ->assertSessionHasErrors('extraction_query');
});

test('TC-INC-13: information review fails when decision value is invalid', function () {
    [, $information] = createDocumentAndInfoFor($this->admin, 'pending');

    $this->actingAs($this->admin)
        ->post(route('admin.information.review', $information), [
            'decision' => 'maybe',
        ])
        ->assertSessionHasErrors('decision');
});

test('TC-INC-14: news generation fails when mode is invalid', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.assistant.generate'), [
            'mode' => 'invalid_mode',
            'prompt' => 'Buat berita',
        ])
        ->assertSessionHasErrors('mode');
});

test('TC-INC-15: news generation fails when information id does not exist', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.assistant.generate'), [
            'information_ids' => [999999],
            'prompt' => 'Buat berita',
        ])
        ->assertSessionHasErrors('information_ids.0');
});

test('TC-INC-16: draft update fails when headline and lead are empty', function () {
    $draft = IntelligentNewsDraft::create([
        'created_by' => $this->admin->getKey(),
        'creation_method' => 'ai',
        'status' => 'draft',
        'version' => 1,
        'title' => 'Judul Awal',
        'excerpt' => 'Ringkasan awal berita.',
        'headline' => 'Judul Awal',
        'lead' => 'Lead awal berita.',
        'body' => ['Paragraf pertama.'],
        'labels' => ['lingkungan'],
        'sources_used' => ['info:1'],
        'warnings' => [],
        'category_id' => $this->category->getKey(),
    ]);

    $this->actingAs($this->admin)
        ->put(route('admin.assistant.drafts.update', $draft), [
            'headline' => '',
            'lead' => '',
            'body' => [],
        ])
        ->assertSessionHasErrors(['headline', 'lead', 'body']);
});

test('TC-INC-17: conflict approval fails when confirmation word is invalid', function () {
    $draft = IntelligentNewsDraft::create([
        'created_by' => $this->admin->getKey(),
        'creation_method' => 'ai',
        'status' => 'draft',
        'version' => 1,
        'title' => 'Judul Konflik',
        'excerpt' => 'Ringkasan konflik.',
        'headline' => 'Judul Konflik',
        'lead' => 'Lead konflik.',
        'body' => ['Isi.'],
        'labels' => ['lingkungan'],
        'sources_used' => ['info:1'],
        'warnings' => [],
        'category_id' => $this->category->getKey(),
    ]);

    $this->actingAs($this->admin)
        ->post(route('admin.assistant.drafts.approve-conflict', $draft), [
            'version' => 1,
            'confirm' => true,
            'confirmation_word' => 'tidak',
        ])
        ->assertSessionHasErrors('confirmation_word');
});

test('TC-INC-18: villager user cannot access ai assistant or upload documents', function () {
    $this->actingAs($this->villager)
        ->get(route('admin.assistant.index'))
        ->assertStatus(302);

    $file = UploadedFile::fake()->createWithContent('test.txt', 'Isi dokumen.');
    $this->actingAs($this->villager)
        ->post(route('admin.documents.store'), [
            'documents' => [$file],
        ])
        ->assertStatus(302);
});
