<?php

/**
 * NewsCreatorController.php
 *
 * This controller manages the creation and archiving of news documents.
 * It provides endpoints for rendering the news creator interface and the
 * document archive view.
 *
 * Used for Admin Panel endpoints.
 */

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateIntelligentNews;
use App\Jobs\ProcessIntelligenceDocument;
use App\Models\IntelligenceDocument;
use App\Models\IntelligenceExtractionRequest;
use App\Models\IntelligenceInformation;
use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsDraftVersion;
use App\Models\IntelligentNewsMessage;
use App\Models\IntelligentNewsRun;
use App\Models\IntelligentNewsRunEvent;
use App\Models\IntelligentNewsSession;
use App\Models\NewsCategory;
use App\Services\News\MetaConnections;
use App\Services\NewsGenerationService;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class NewsCreatorController extends Controller
{
    public function documents(): Response
    {
        return $this->renderArchive(false);
    }

    public function archivedDocuments(): Response
    {
        return $this->renderArchive(true);
    }

    public function create(Request $request): Response
    {
        $information = IntelligenceInformation::query()
            ->with('document:id,original_name,status')
            ->where('is_active', true)
            ->where('review_status', 'approved')
            ->whereHas('document', fn ($query) => $query
                ->where('uploaded_by', $request->user()->getKey())
                ->whereNull('archived_at'))
            ->latest()
            ->limit(200)
            ->get();

        $newsSession = $request->integer('session')
            ? IntelligentNewsSession::query()->with(['messages', 'runs.events'])
                ->where('created_by', $request->user()->getKey())->find($request->integer('session'))
            : null;
        $generatedArticle = null;
        // A completed conversation owns its preview even when reopened without ?draft=.
        if ($draftId = ($request->integer('draft') ?: $newsSession?->draft_id)) {
            $draft = IntelligentNewsDraft::query()
                ->with(['informationSources.document', 'category', 'qualityEvaluations'])
                ->where('created_by', $request->user()->getKey())
                ->find($draftId);

            if ($draft) {
                $generatedArticle = [
                    'draft_id' => $draft->id,
                    'headline' => $draft->headline,
                    'subheadline' => $draft->subheadline,
                    'lead' => $draft->lead,
                    'body' => $draft->body,
                    'summary' => $draft->summary,
                    'labels' => $draft->labels,
                    'category' => $draft->category?->name,
                    'sources_used' => $draft->sources_used,
                    'warnings' => $draft->warnings,
                    'image' => $draft->image,
                    'version' => $draft->version,
                    'reviewed_at' => $draft->reviewed_at?->toIso8601String(),
                    'updated_at' => $draft->updated_at?->toIso8601String(),
                    'quality' => optional($draft->qualityEvaluations->first())->only([
                        'overall_score', 'quality_label', 'publish_blocked', 'dimensions',
                        'claim_checks', 'warnings', 'evaluation_version', 'evaluator_model',
                    ]),
                    'selected_sources' => $draft->informationSources->map(fn ($item) => [
                        'id' => $item->id,
                        'document_id' => $item->document_id,
                        'title' => $item->title,
                        'document' => $item->document->original_name,
                        'evidence' => $item->evidence,
                    ])->values(),
                ];
            }
        }

        $preselectedInformationIds = [];
        if ($documentId = $request->integer('doc')) {
            $preselectedInformationIds = $information
                ->where('document_id', $documentId)
                ->pluck('id')
                ->values();
        }
        $initialDocumentIds = collect(explode(',', (string) $request->query('documents')))
            ->filter(fn ($id) => ctype_digit($id))
            ->map(fn ($id) => (int) $id)
            ->values();
        if ($initialDocumentIds->isNotEmpty()) {
            $preselectedInformationIds = $information
                ->whereIn('document_id', $initialDocumentIds)
                ->pluck('id')
                ->values();
        }
        $initialInformationIds = collect(explode(',', (string) $request->query('information')))
            ->filter(fn ($id) => ctype_digit($id))
            ->map(fn ($id) => (int) $id);
        $preselectedInformationIds = collect($preselectedInformationIds)
            ->merge($initialInformationIds)
            ->unique()
            ->values();

        $documents = IntelligenceDocument::query()
            ->where('uploaded_by', $request->user()->getKey())
            ->where('status', 'ready')
            ->whereNull('archived_at')
            ->latest()
            ->limit(200)
            ->get(['id', 'original_name', 'status', 'created_at']);

        $pendingInformation = collect();
        if ($newsSession) {
            $documents = $documents->merge(IntelligenceDocument::query()
                ->where('uploaded_by', $request->user()->getKey())
                ->whereIn('id', $newsSession->selected_document_ids ?? [])
                ->whereNull('archived_at')
                ->get(['id', 'original_name', 'status', 'created_at']))->values();
            $pendingInformation = IntelligenceInformation::query()
                ->with('document:id,original_name')
                ->whereIn('document_id', $newsSession->selected_document_ids ?? [])
                ->where('review_status', 'pending')
                ->whereHas('document', fn ($query) => $query
                    ->where('uploaded_by', $request->user()->getKey())
                    ->whereNull('archived_at'))
                ->orderBy('document_id')
                ->orderBy('item_index')
                ->get()
                ->map(fn (IntelligenceInformation $item) => [
                    'id' => $item->id,
                    'document_id' => $item->document_id,
                    'title' => $item->title,
                    'summary' => $item->summary,
                    'evidence' => $item->evidence ?? [],
                    'confidence' => $item->confidence,
                    'quality_score' => $item->quality_score,
                    'document' => [
                        'id' => $item->document->id,
                        'original_name' => $item->document->original_name,
                    ],
                ]);
        }

        $sessions = IntelligentNewsSession::where('created_by', $request->user()->getKey())
            ->whereNull('archived_at')->whereDoesntHave('draft', fn ($q) => $q->where('status', 'published'))
            ->latest('updated_at')->get()->map(function ($session) use ($request) {
                $queued = $session->messages()->reorder()->latest('id')->where('intent', 'queued_request')->first();
                $requestId = data_get($queued?->payload, 'request_id');
                $progress = $requestId ? Cache::get(GenerateIntelligentNews::cacheKey($request->user()->getKey(), $requestId)) : null;
                $pendingCategory = $session->messages()->where('intent', 'category_proposal')->where('payload->category_proposal->status', 'pending')->exists();

                return ['id' => $session->id, 'title' => $session->title ?: mb_substr($session->prompt ?: 'Dokumen dan informasi', 0, 70),
                    'status' => in_array($progress['status'] ?? '', ['queued', 'running', 'failed']) ? $progress['status'] : ($pendingCategory ? 'awaiting_approval' : $session->status),
                    'request_id' => in_array($progress['status'] ?? '', ['queued', 'running']) ? $requestId : null,
                    'has_draft' => (bool) $session->draft_id,
                    'recent' => $session->updated_at->greaterThanOrEqualTo(now()->subDays(7))];
            })->filter(fn ($session) => in_array($session['status'], ['queued', 'running', 'processing_files', 'awaiting_answers', 'awaiting_approval', 'ready_to_generate'])
                || (! $session['has_draft'] && $session['recent']))->values();

        return inertia('admin/intelligentnewscreator/chat', [
            'publishPlatforms' => app(MetaConnections::class)->platforms($request->user()->getKey()),
            'metaAuth' => app(MetaConnections::class)->publicConfig(),
            'sessions' => $sessions,
            'categories' => NewsCategory::active()->orderBy('name')->get(['categoryID', 'name']),
            'informationItems' => $information,
            'documents' => $documents,
            'generatedArticle' => $generatedArticle,
            'preselectedInformationIds' => $preselectedInformationIds,
            'initialDocumentIds' => $initialDocumentIds,
            'initialPrompt' => $request->query('prompt'),
            'initialManualFact' => $request->query('fact'),
            'autoGenerate' => $request->boolean('generate'),
            'conversationReadOnly' => (isset($draft) && $draft->status !== 'draft') || $newsSession?->draft?->status === 'published',
            'newsSession' => $newsSession,
            'pendingInformation' => $pendingInformation,
        ]);
    }

    public function storeDocument(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'session_id' => ['nullable', 'integer', 'exists:intelligent_news_sessions,id'],
            'origin' => ['nullable', 'in:assistant,library'],
            'draft_id' => ['nullable', 'integer', 'exists:intelligent_news_drafts,id'],
            'documents' => ['required', 'array', 'min:1', 'max:5'],
            'documents.*' => ['required', 'file', 'max:20480', 'mimes:pdf,jpg,jpeg,png,docx,xlsx,xlsm,csv,txt'],
            'prompt' => ['nullable', 'string', 'max:2000'],
            'manual_fact' => ['nullable', 'string', 'max:2000'],
            'information_ids' => ['nullable', 'array'],
            'information_ids.*' => ['integer', 'exists:intelligence_information,id'],
            'document_ids' => ['nullable', 'array'],
            'document_ids.*' => ['integer', 'exists:intelligence_documents,id'],
            'intent' => ['nullable', 'in:extract_information,generate_news,store_document,question,analysis'],
            'extraction_mode' => ['nullable', 'in:general,targeted'],
            'extraction_query' => ['nullable', 'string', 'max:2000', 'required_if:extraction_mode,targeted'],
            'keywords' => ['nullable', 'array', 'max:20'],
            'keywords.*' => ['string', 'max:100'],
        ]);
        if (! empty($validated['session_id'])) {
            IntelligentNewsSession::where('created_by', $request->user()->getKey())->findOrFail($validated['session_id'])->assertWritable();
        }
        $disk = config('filesystems.default');
        $documents = collect($validated['documents'])->map(function ($file) use ($request, $validated, $disk) {
            $path = $file->store('intelligence-documents', $disk);
            if (! $path) {
                throw new \RuntimeException("Unable to store {$file->getClientOriginalName()} on the {$disk} disk.");
            }

            $document = IntelligenceDocument::create([
                'uploaded_by' => $request->user()->getKey(),
                'original_name' => $file->getClientOriginalName(),
                'storage_disk' => $disk,
                'storage_path' => $path,
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'sha256' => hash_file('sha256', $file->getRealPath()),
                'status' => 'processing',
                'embedding_status' => 'pending',
                'archive_after' => now()->addYears(3),
            ]);
            $mode = $validated['extraction_mode'] ?? 'general';
            $query = trim((string) ($validated['extraction_query'] ?? '')) ?: null;
            $extractionRequest = IntelligenceExtractionRequest::create([
                'document_id' => $document->id,
                'requested_by' => $request->user()->getKey(),
                'mode' => $mode,
                'original_prompt' => $validated['prompt'] ?? $query,
                'normalized_query' => $mode === 'targeted'
                    ? $query
                    : 'Extract all distinct and important information.',
                'keywords' => collect($validated['keywords'] ?? [])->filter()->unique()->values()->all(),
                'status' => 'pending',
            ]);

            return [$document, $extractionRequest];
        });

        $documentModels = $documents->pluck(0);

        if (($validated['origin'] ?? 'library') !== 'assistant') {
            $documents->each(fn (array $pair) => ProcessIntelligenceDocument::dispatch($pair[0]->id, $pair[1]->id)
                ->onQueue('documents'));

            return back()->with('success', "{$documentModels->count()} dokumen masuk antrean ekstraksi.");
        }

        $intent = $validated['intent'] ?? 'extract_information';
        $session = isset($validated['session_id'])
            ? IntelligentNewsSession::query()
                ->where('created_by', $request->user()->getKey())
                ->findOrFail($validated['session_id'])
            : new IntelligentNewsSession;
        $session->assertWritable();
        $existingDocumentIds = collect($session->selected_document_ids ?? []);
        $session->fill([
            'created_by' => $request->user()->getKey(),
            'status' => ($validated['intent'] ?? '') === 'store_document' ? 'collecting_sources' : 'processing_files',
            'current_intent' => $intent,
            'prompt' => $validated['prompt'] ?? $session->prompt,
            'selected_document_ids' => $documentModels->pluck('id')
                ->merge($validated['document_ids'] ?? [])
                ->merge($existingDocumentIds)
                ->unique()->values()->all(),
            'selected_information_ids' => collect($validated['information_ids'] ?? $session->selected_information_ids ?? [])
                ->unique()->values()->all(),
            'user_facts' => filled($validated['manual_fact'] ?? null)
                ? [['field' => 'additional_context', 'value' => $validated['manual_fact']]]
                : ($session->user_facts ?? []),
            'pending_questions' => [],
            'conflicts' => [],
            'last_message_at' => now(),
        ]);
        $session->save();
        $fileNames = $documentModels->pluck('original_name')->implode(', ');
        IntelligentNewsMessage::create([
            'session_id' => $session->id,
            'role' => 'user',
            'intent' => $intent,
            'content' => $validated['prompt'] ?? ($intent === 'generate_news'
                ? 'Buat berita dari dokumen yang dilampirkan.'
                : 'Ekstrak semua informasi penting dari dokumen ini.'),
            'payload' => [
                'document_ids' => $documentModels->pluck('id')->all(),
                'filenames' => $documentModels->pluck('original_name')->all(),
            ],
        ]);
        IntelligentNewsMessage::create([
            'session_id' => $session->id,
            'role' => 'assistant',
            'intent' => 'document_processing',
            'content' => $intent === 'store_document' ? "File disimpan: {$fileNames}. Ekstraksi dan pembuatan berita belum dijalankan. Anda dapat memprosesnya dari Arsip Dokumen." : "Saya menerima {$documentModels->count()} file: {$fileNames}. Saya akan membaca dokumen, mengekstrak fakta dan bukti, lalu memberi tahu Anda ketika proses selesai. Anda boleh meninggalkan halaman ini sementara pemrosesan berjalan.",
            'payload' => [
                'status' => 'processing',
                'document_ids' => $documentModels->pluck('id')->all(),
            ],
        ]);

        if ($intent === 'store_document') {
            $documents->each(function (array $pair) {
                $pair[0]->update(['status' => 'ready']);
                $pair[1]->update(['status' => 'completed', 'completed_at' => now()]);
            });
        } else {
            $documents->each(fn (array $pair) => ProcessIntelligenceDocument::dispatch($pair[0]->id, $pair[1]->id)
                ->onQueue('documents'));
        }

        return redirect()->route('admin.assistant.index', ['session' => $session->id])
            ->with('success', $intent === 'store_document' ? 'Dokumen disimpan tanpa ekstraksi.' : "{$documentModels->count()} dokumen disimpan dan sedang diproses di latar belakang.");
    }

    public function retryDocument(Request $request, IntelligenceDocument $document): RedirectResponse
    {
        abort_unless($document->uploaded_by === $request->user()->getKey(), 403);
        if ($document->status === 'ready') {
            return back()->withErrors(['document' => 'Dokumen ini sudah selesai diproses.']);
        }

        $document->update([
            'status' => 'processing',
            'embedding_status' => 'pending',
            'error_message' => null,
        ]);
        ProcessIntelligenceDocument::dispatch($document->id)->onQueue('documents');

        return back()->with('success', 'Dokumen dimasukkan kembali ke antrean.');
    }

    public function previewDocument(Request $request, IntelligenceDocument $document)
    {
        abort_unless($document->uploaded_by === $request->user()->getKey(), 403);

        $disk = Storage::disk($document->storage_disk);
        abort_unless($disk->exists($document->storage_path), 404, 'File dokumen tidak ditemukan.');

        $extension = strtolower(pathinfo($document->original_name, PATHINFO_EXTENSION));
        if ($request->boolean('download')) {
            return $disk->download($document->storage_path, $document->original_name);
        }
        if (in_array($extension, ['docx', 'xlsx', 'xlsm', 'csv'], true)) {
            try {
                $normalized = $this->aiClient()->attach('file', $disk->get($document->storage_path), $document->original_name)
                    ->post(rtrim(config('services.apakhabar_ai.url'), '/').'/documents/upload')->throw()->json();
                $elements = collect($normalized['elements'] ?? []);
                $groups = $elements->groupBy(fn ($element) => data_get($element, 'source.sheet') ?: 'Isi dokumen');

                return response()->view('documents.preview', ['document' => $document, 'groups' => $groups, 'error' => null])
                    ->header('X-Content-Type-Options', 'nosniff')->header('Cache-Control', 'private, no-store');
            } catch (\Throwable $exception) {
                report($exception);

                return response()->view('documents.preview', ['document' => $document, 'groups' => collect(),
                    'error' => 'Pratinjau belum tersedia. Pastikan layanan AI aktif atau unduh file asli.'], 503);
            }
        }

        $previewable = in_array($extension, ['pdf', 'jpg', 'jpeg', 'png', 'txt', 'csv', 'docx', 'xlsx', 'xlsm'], true);

        if (! $previewable) {
            return $disk->download($document->storage_path, $document->original_name);
        }

        return $disk->response($document->storage_path, $document->original_name, [
            'Content-Type' => $document->mime_type ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store, max-age=0',
        ], 'inline');
    }

    public function documentProgress(Request $request, IntelligenceDocument $document): JsonResponse
    {
        abort_unless($document->uploaded_by === $request->user()->getKey(), 403);
        if (in_array($document->status, ['ready', 'failed'], true)) {
            return response()->json(['stage' => $document->status, 'label' => $document->status === 'ready'
                ? 'Dokumen selesai diproses' : 'Pemrosesan dokumen gagal']);
        }
        $id = Cache::get('document-progress:'.$document->id);
        if (! $id) {
            return response()->json(['stage' => 'queued', 'label' => 'Menunggu pekerja antrean dokumen']);
        }
        try {
            $result = $this->aiClient()->timeout(3)->get(
                rtrim(config('services.apakhabar_ai.url'), '/').'/documents/progress/'.$id,
            );
            if ($result->status() === 404) {
                return response()->json(['stage' => 'starting', 'label' => 'Mengirim dokumen ke layanan AI']);
            }

            return response()->json($result->throw()->json());
        } catch (\Throwable $exception) {
            return response()->json(['stage' => 'unavailable', 'label' => 'Pembaruan terputus; mencoba lagi'], 503);
        }
    }

    public function agentProgress(Request $request, string $requestId): JsonResponse
    {
        $job = Cache::get(
            GenerateIntelligentNews::cacheKey($request->user()->getKey(), $requestId),
        );
        if ($job && in_array($job['status'], ['queued', 'completed', 'failed'], true)) {
            return response()->json($job);
        }
        $event = IntelligentNewsRunEvent::query()
            ->where('event_type', 'agent_run')
            ->where('payload->client_request_id', $requestId)
            ->whereIn('run_id', IntelligentNewsRun::query()->whereIn('session_id',
                IntelligentNewsSession::query()->where('created_by', $request->user()->getKey())->select('id')
            )->select('id'))->latest('id')->first();
        if (! $event) {
            abort_unless($job, 404);

            return response()->json($job);
        }
        $message = IntelligentNewsMessage::find(
            IntelligentNewsRun::whereKey($event->run_id)->value('user_message_id'),
        );
        try {
            $response = $this->aiClient()->timeout(5)->get(
                rtrim(config('services.apakhabar_ai.url'), '/').'/agent/runs/'.rawurlencode($event->payload['agent_run_id']),
                ['owner_id' => (string) $request->user()->getKey()],
            )->throw()->json();

            return response()->json(['status' => $job ? 'running' : $response['status'], 'events' => $response['events'] ?? [], 'message' => $message]);
        } catch (\Throwable $exception) {
            return response()->json(['status' => 'unavailable', 'events' => []], 503);
        }
    }

    public function generate(Request $request): RedirectResponse
    {
        $result = app(NewsGenerationService::class)->generate(
            $request->user()->getKey(), $request->validate(NewsGenerationService::rules()),
        );

        return isset($result['errors']) ? back()->withErrors($result['errors']) : redirect($result['url']);
    }

    public function generateAsync(Request $request): JsonResponse
    {
        $validated = $request->validate(array_merge(NewsGenerationService::rules(), [
            'request_id' => ['required', 'uuid'],
        ]));
        abort_if(config('queue.default') === 'sync', 503, 'Configure an asynchronous queue and start the queue worker.');
        $key = GenerateIntelligentNews::cacheKey($request->user()->getKey(), $validated['request_id']);
        if (Cache::add($key, [
            'status' => 'queued', 'events' => [], 'queued_at' => now()->timestamp,
        ], now()->addDay())) {
            try {
                $session = isset($validated['session_id'])
                    ? IntelligentNewsSession::where('created_by', $request->user()->getKey())->findOrFail($validated['session_id'])
                    : IntelligentNewsSession::create(['created_by' => $request->user()->getKey(), 'status' => 'collecting_sources',
                        'title' => mb_substr($validated['prompt'] ?? 'Percakapan baru', 0, 100),
                        'selected_document_ids' => [], 'selected_information_ids' => [], 'user_facts' => [], 'pending_questions' => [], 'conflicts' => []]);
                $session->assertWritable();
                $validated['session_id'] = $session->id;
                $session->messages()->create(['role' => 'system', 'intent' => 'queued_request', 'content' => 'Permintaan sedang diproses.', 'payload' => ['request_id' => $validated['request_id']]]);
                $session->touch();
                GenerateIntelligentNews::dispatch($request->user()->getKey(), $validated)->onQueue('generation');
            } catch (\Throwable $exception) {
                Cache::forget($key);
                throw $exception;
            }
        }

        return response()->json(['request_id' => $validated['request_id'], 'status' => 'queued'], 202);
    }

    public function recommend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'max:2000'],
        ]);

        try {
            $response = $this->aiClient()
                ->post(rtrim(config('services.apakhabar_ai.url'), '/').'/rag/information/search', [
                    'query' => $validated['query'],
                    'owner_id' => (string) $request->user()->getKey(),
                    'top_k' => 8,
                    'information_ids' => IntelligenceInformation::query()
                        ->where('review_status', 'approved')->where('is_active', true)
                        ->whereHas('document', fn ($query) => $query
                            ->where('uploaded_by', $request->user()->getKey())->whereNull('archived_at'))
                        ->pluck('id')->map(fn ($id) => (string) $id)->all(),
                ])
                ->throw()
                ->json('results', []);
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json([
                'recommendations' => [],
                'message' => 'Layanan pencarian AI tidak tersedia. Pastikan FastAPI dan Ollama sedang berjalan.',
            ], 503);
        }

        $information = IntelligenceInformation::query()
            ->with('document:id,original_name')
            ->whereIn('id', collect($response)->pluck('information_id')->map(fn ($id) => (int) $id))
            ->where('review_status', 'approved')
            ->whereHas('document', fn ($query) => $query
                ->where('uploaded_by', $request->user()->getKey())
                ->whereNull('archived_at'))
            ->get()->keyBy('id');

        $recommendations = collect($response)->map(function ($result) use ($information) {
            $item = $information->get((int) $result['information_id']);
            if (! $item) {
                return null;
            }

            return [
                'information_id' => $item->id,
                'document_id' => $item->document_id,
                'name' => $item->title,
                'source' => $result['source'],
                'excerpt' => $result['content'],
                'distance' => $result['distance'],
            ];
        })->filter()->unique('information_id')->values();

        return response()->json(['recommendations' => $recommendations]);
    }

    public function updateDraft(Request $request, IntelligentNewsDraft $draft): RedirectResponse
    {
        abort_unless($draft->created_by === $request->user()->getKey(), 403);
        abort_unless($draft->status === 'draft', 422, 'Only draft content can be edited.');

        if ($request->has('content') || $request->has('title')) {
            $data = $request->validate([
                'title' => ['required', 'string', 'max:255'],
                'content' => ['required', 'string'],
            ]);
            $validated = ['title' => $data['title'], 'content' => trim($data['content'])];
        } else {
            $validated = $request->validate([
                'headline' => ['required', 'string', 'max:255'],
                'subheadline' => ['nullable', 'string', 'max:255'],
                'lead' => ['required', 'string'],
                'body' => ['required', 'array', 'min:1'],
                'body.*' => ['required', 'string'],
            ]);

        }

        $draft->update([
            ...$validated,
            'version' => $draft->version + 1,
            'reviewed_at' => null,
        ]);
        $this->storeDraftVersion($draft->fresh(), $request->user()->getKey(), 'edited', 'manual');

        return redirect()->route('admin.assistant.index', ['draft' => $draft->id])
            ->with('success', 'Perubahan draf berhasil disimpan. Tinjau versi baru sebelum publikasi.');
    }

    public function reviewDraft(Request $request, IntelligentNewsDraft $draft): RedirectResponse
    {
        abort_unless($draft->created_by === $request->user()->getKey(), 403);
        abort_unless($draft->status === 'draft', 422, 'Only draft content can be reviewed.');

        $draft->update(['reviewed_at' => now()]);

        return redirect()->route('admin.assistant.index', ['draft' => $draft->id])
            ->with('success', 'Draf ditandai telah ditinjau dan siap dipublikasikan.');
    }

    public function uploadDraftImage(Request $request, IntelligentNewsDraft $draft): RedirectResponse
    {
        abort_unless($draft->created_by === $request->user()->getKey(), 403);
        abort_unless($draft->status === 'draft', 422, 'Only draft content can be edited.');

        $validated = $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);
        $disk = config('filesystems.news_media_disk', 'public');
        $path = $validated['image']->storePublicly('news-images', $disk);

        if (! $path) {
            return back()->withErrors(['image' => 'Gambar gagal disimpan. Silakan coba lagi.']);
        }

        $draft->update([
            'image' => Storage::disk($disk)->url($path),
            'version' => $draft->version + 1,
            'reviewed_at' => null,
        ]);
        $this->storeDraftVersion($draft->fresh(), $request->user()->getKey(), 'image_changed', 'manual');

        return redirect()->route('admin.assistant.index', ['draft' => $draft->id])
            ->with('success', 'Gambar berita berhasil diunggah. Tinjau versi baru sebelum publikasi.');
    }

    public function archive(): Response
    {
        return $this->renderArchive(false);
    }

    private function aiClient(): PendingRequest
    {
        $timeout = max(1, (int) config('services.apakhabar_ai.timeout', 180));
        $connectTimeout = max(1, (int) config('services.apakhabar_ai.connect_timeout', 5));

        // Local OCR and Ollama inference can legitimately exceed PHP's default
        // 30-second request limit. Keep PHP alive slightly longer than Guzzle so
        // timeout exceptions can be handled and returned to the interface.
        if (function_exists('set_time_limit')) {
            @set_time_limit($timeout + 10);
        }

        $client = Http::acceptJson()
            ->connectTimeout($connectTimeout)
            ->timeout($timeout);

        if ($token = config('services.apakhabar_ai.token')) {
            $client->withHeaders(['X-ApaKhabar-Service-Token' => $token]);
        }

        return $client;
    }

    private function resolveCategoryId(array $article): int
    {
        $categories = NewsCategory::query()->active()
            ->orderBy('display_order')->get(['categoryID', 'name', 'is_default']);
        $requested = mb_strtolower(trim((string) ($article['category'] ?? '')));
        $labels = collect($article['labels'] ?? [])->map(fn ($label) => mb_strtolower((string) $label));

        $exact = $categories->first(fn ($category) => mb_strtolower($category->name) === $requested
            || $labels->contains(mb_strtolower($category->name)));
        if ($exact) {
            return $exact->categoryID;
        }

        return (int) ($categories->firstWhere('is_default', true)?->categoryID
            ?? $categories->firstWhere('name', 'Lainnya')?->categoryID
            ?? $categories->firstOrFail()->categoryID);
    }

    private function storeDraftVersion(
        IntelligentNewsDraft $draft,
        int $userId,
        string $changeType,
        string $revisionSource = 'manual',
        ?string $revisionInstruction = null,
    ): IntelligentNewsDraftVersion {
        return IntelligentNewsDraftVersion::updateOrCreate(
            ['draft_id' => $draft->id, 'version' => $draft->version],
            [
                'change_type' => $changeType,
                'revision_source' => $revisionSource,
                'revision_instruction' => $revisionInstruction,
                'created_by' => $userId,
                'snapshot' => $draft->only([
                    'title', 'content', 'excerpt', 'labels',
                    'sources_used', 'warnings', 'category_id', 'image', 'user_prompt',
                ]),
            ],
        );
    }

    public function reviewInformation(
        Request $request,
        IntelligenceInformation $information,
    ): RedirectResponse {
        abort_unless($information->document->uploaded_by === $request->user()->getKey(), 403);
        $validated = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
        ]);
        $approved = $validated['decision'] === 'approved';
        $information->update([
            'review_status' => $validated['decision'],
            'is_active' => $approved,
            'reviewed_by' => $request->user()->getKey(),
            'reviewed_at' => now(),
            'information_embedding_status' => $approved ? 'pending' : 'failed',
        ]);

        if ($approved) {
            try {
                $this->indexInformation(collect([$information]), $request->user()->getKey());
                $information->update(['information_embedding_status' => 'ready']);
            } catch (\Throwable $exception) {
                report($exception);
                $information->update(['information_embedding_status' => 'failed']);

                return back()->withErrors([
                    'information' => 'Informasi disetujui, tetapi indeks pencarian belum berhasil dibuat.',
                ]);
            }
            $this->attachApprovedInformationToWaitingSessions(
                collect([$information->id]),
                $information->document_id,
                $request->user()->getKey(),
            );
        } else {
            $this->removeInformationVector($information->id);
            $information->delete();
        }

        return back()->with('success', $approved
            ? 'Informasi disetujui dan ditambahkan ke pustaka pencarian.'
            : 'Informasi ditolak dan dipindahkan dari pustaka aktif.');
    }

    public function bulkReviewInformation(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'information_ids' => ['required', 'array', 'min:1', 'max:100'],
            'information_ids.*' => ['required', 'integer', 'distinct'],
            'decision' => ['required', 'in:approved,rejected'],
        ]);
        $information = IntelligenceInformation::query()
            ->with('document')
            ->whereIn('id', $validated['information_ids'])
            ->where('review_status', 'pending')
            ->whereHas('document', fn ($query) => $query
                ->where('uploaded_by', $request->user()->getKey())
                ->whereNull('archived_at'))
            ->get();

        if ($information->count() !== count($validated['information_ids'])) {
            return back()->withErrors([
                'information' => 'Sebagian informasi tidak ditemukan, bukan milik Anda, atau sudah ditinjau.',
            ]);
        }

        $approved = $validated['decision'] === 'approved';
        IntelligenceInformation::query()
            ->whereIn('id', $information->pluck('id'))
            ->update([
                'review_status' => $validated['decision'],
                'is_active' => $approved,
                'reviewed_by' => $request->user()->getKey(),
                'reviewed_at' => now(),
                'information_embedding_status' => $approved ? 'pending' : 'failed',
            ]);

        if ($approved) {
            try {
                $this->indexInformation($information, $request->user()->getKey());
                IntelligenceInformation::query()->whereIn('id', $information->pluck('id'))
                    ->update(['information_embedding_status' => 'ready']);
            } catch (\Throwable $exception) {
                report($exception);
                IntelligenceInformation::query()->whereIn('id', $information->pluck('id'))
                    ->update(['information_embedding_status' => 'failed']);

                return back()->withErrors([
                    'information' => "{$information->count()} informasi disetujui, tetapi indeks pencarian belum berhasil dibuat.",
                ]);
            }
            $information->groupBy('document_id')->each(
                fn ($items, $documentId) => $this->attachApprovedInformationToWaitingSessions(
                    $items->pluck('id'),
                    (int) $documentId,
                    $request->user()->getKey(),
                ),
            );
        } else {
            $information->each(function (IntelligenceInformation $item): void {
                $this->removeInformationVector($item->id);
                $item->delete();
            });
        }

        return back()->with('success', $approved
            ? "{$information->count()} informasi disetujui dan ditambahkan ke pustaka pencarian."
            : "{$information->count()} informasi ditolak dan dipindahkan dari pustaka aktif.");
    }

    public function archiveDocument(Request $request, IntelligenceDocument $document): RedirectResponse
    {
        abort_unless($document->uploaded_by === $request->user()->getKey(), 403);
        if ($document->archived_at) {
            return back()->withErrors(['document' => 'Dokumen ini sudah berada di arsip.']);
        }

        $document->update(['archived_at' => now()]);
        $document->information()->update(['is_active' => false]);
        $document->information()->where('review_status', 'approved')->get()
            ->each(fn (IntelligenceInformation $item) => $this->removeInformationVector($item->id));

        return redirect()->route('admin.documents.index')
            ->with('success', 'Dokumen dipindahkan ke arsip dan tidak lagi tersedia untuk AI.');
    }

    public function restoreDocument(Request $request, IntelligenceDocument $document): RedirectResponse
    {
        abort_unless($document->uploaded_by === $request->user()->getKey(), 403);
        if (! $document->archived_at) {
            return back()->withErrors(['document' => 'Dokumen ini tidak berada di arsip.']);
        }

        $document->update([
            'archived_at' => null,
            'archive_after' => now()->addYears(3),
        ]);
        $approved = $document->information()->where('review_status', 'approved')->get();
        $document->information()->where('review_status', 'approved')->update(['is_active' => true]);

        if ($approved->isNotEmpty()) {
            try {
                $this->indexInformation($approved, $request->user()->getKey());
                IntelligenceInformation::query()->whereIn('id', $approved->pluck('id'))
                    ->update(['information_embedding_status' => 'ready']);
            } catch (\Throwable $exception) {
                report($exception);
                IntelligenceInformation::query()->whereIn('id', $approved->pluck('id'))
                    ->update(['information_embedding_status' => 'failed']);

                return redirect()->route('admin.documents.index')->withErrors([
                    'information' => 'Dokumen dipulihkan, tetapi indeks pencarian perlu dibuat ulang.',
                ]);
            }
        }

        return redirect()->route('admin.documents.index')
            ->with('success', 'Dokumen dipulihkan ke pustaka aktif.');
    }

    private function indexInformation($information, int $ownerId): void
    {
        $this->aiClient()->post(
            rtrim(config('services.apakhabar_ai.url'), '/').'/rag/information/index',
            ['items' => $information->map(fn (IntelligenceInformation $item) => [
                'information_id' => (string) $item->id,
                'document_id' => (string) $item->document_id,
                'title' => $item->title,
                'summary' => $item->summary,
                'labels' => $item->labels ?? [],
                'fields' => (object) ($item->fields ?? []),
                'source' => $item->document->original_name,
                'owner_id' => (string) $ownerId,
                'evidence' => $item->evidence ?? [],
                'review_status' => 'approved',
                'is_active' => true,
                'archived' => false,
            ])->values()->all()],
        )->throw();
    }

    private function removeInformationVector(int $informationId): void
    {
        try {
            $this->aiClient()->delete(
                rtrim(config('services.apakhabar_ai.url'), '/')."/rag/information/{$informationId}?owner_id=".rawurlencode((string) auth()->id()),
            )->throw();
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function attachApprovedInformationToWaitingSessions($informationIds, int $documentId, int $userId): void
    {
        IntelligentNewsSession::query()
            ->where('created_by', $userId)
            ->whereIn('status', ['ready_to_generate', 'collecting_sources'])
            ->get()
            ->filter(fn (IntelligentNewsSession $session) => in_array(
                $documentId,
                array_map('intval', $session->selected_document_ids ?? []),
                true,
            ))
            ->each(function (IntelligentNewsSession $session) use ($informationIds): void {
                $session->update([
                    'selected_information_ids' => collect($session->selected_information_ids ?? [])
                        ->merge($informationIds)
                        ->map(fn ($id) => (int) $id)
                        ->unique()
                        ->values()
                        ->all(),
                    'last_message_at' => now(),
                ]);
            });
    }

    private function renderArchive(bool $archived = false): Response
    {
        $documents = IntelligenceDocument::query()
            ->with('information:id,document_id,title,summary,fields,confidence,review_status,quality_score,information_embedding_status')
            ->where('uploaded_by', request()->user()->getKey())
            ->when(
                $archived,
                fn ($query) => $query->whereNotNull('archived_at'),
                fn ($query) => $query->whereNull('archived_at'),
            )
            ->latest()
            ->get()
            ->map(fn ($document) => [
                'id' => $document->id,
                'name' => $document->original_name,
                'type' => match (strtolower(pathinfo($document->original_name, PATHINFO_EXTENSION))) {
                    'jpg', 'jpeg', 'png' => 'img',
                    'pdf' => 'pdf',
                    'xlsx', 'xlsm', 'csv' => 'spreadsheet',
                    'txt' => 'txt',
                    default => 'docx',
                },
                'size' => number_format($document->file_size / 1024 / 1024, 2).' MB',
                'date' => $document->created_at->diffForHumans(),
                'archive_after' => $document->archive_after?->toIso8601String(),
                'archived_at' => $document->archived_at?->toIso8601String(),
                'status' => $document->status,
                'error' => $document->error_message,
                'attempts' => $document->processing_attempts,
                'previewable' => in_array(
                    strtolower(pathinfo($document->original_name, PATHINFO_EXTENSION)),
                    ['pdf', 'jpg', 'jpeg', 'png', 'txt', 'csv', 'docx', 'xlsx', 'xlsm'],
                    true,
                ),
                'category' => 'Information',
                'extract' => $document->information->map(fn ($item) => [
                    'id' => $item->id,
                    'year' => data_get($item->fields, 'date', 'Information'),
                    'text' => $item->title.' — '.$item->summary,
                    'confidence' => $item->confidence,
                    'quality_score' => $item->quality_score,
                    'review_status' => $item->review_status,
                    'embedding_status' => $item->information_embedding_status,
                ])->values(),
            ]);

        return Inertia::render('admin/intelligentnewscreator/documents', [
            'documents' => $documents,
            'archived' => $archived,
        ]);
    }
}
