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
use App\Jobs\ProcessIntelligenceDocument;
use App\Models\AiQualityEvaluation;
use App\Models\IntelligenceDocument;
use App\Models\IntelligenceExtractionRequest;
use App\Models\IntelligenceInformation;
use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsDraftVersion;
use App\Models\IntelligentNewsMessage;
use App\Models\IntelligentNewsRun;
use App\Models\IntelligentNewsRunEvent;
use App\Models\IntelligentNewsSession;
use App\Models\IntelligentNewsSourceSelection;
use App\Models\NewsCategory;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
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

        $generatedArticle = null;
        if ($draftId = $request->integer('draft')) {
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

        $newsSession = null;
        $pendingInformation = collect();
        if ($sessionId = $request->integer('session')) {
            $newsSession = IntelligentNewsSession::query()
                ->with(['messages', 'runs.events'])
                ->where('created_by', $request->user()->getKey())
                ->find($sessionId);

            if ($newsSession) {
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
        }

        return inertia('admin/intelligentnewscreator/chat', [
            'informationItems' => $information,
            'documents' => $documents,
            'generatedArticle' => $generatedArticle,
            'preselectedInformationIds' => $preselectedInformationIds,
            'initialDocumentIds' => $initialDocumentIds,
            'initialPrompt' => $request->query('prompt'),
            'initialManualFact' => $request->query('fact'),
            'autoGenerate' => $request->boolean('generate'),
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
            'intent' => ['nullable', 'in:extract_information,generate_news'],
            'extraction_mode' => ['nullable', 'in:general,targeted'],
            'extraction_query' => ['nullable', 'string', 'max:2000', 'required_if:extraction_mode,targeted'],
            'keywords' => ['nullable', 'array', 'max:20'],
            'keywords.*' => ['string', 'max:100'],
        ]);
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
        $existingDocumentIds = collect($session->selected_document_ids ?? []);
        $session->fill([
            'created_by' => $request->user()->getKey(),
            'status' => 'processing_files',
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
            'content' => "Saya menerima {$documentModels->count()} file: {$fileNames}. Saya akan membaca dokumen, mengekstrak fakta dan bukti, lalu memberi tahu Anda ketika proses selesai. Anda boleh meninggalkan halaman ini sementara pemrosesan berjalan.",
            'payload' => [
                'status' => 'processing',
                'document_ids' => $documentModels->pluck('id')->all(),
            ],
        ]);

        $documents->each(fn (array $pair) => ProcessIntelligenceDocument::dispatch($pair[0]->id, $pair[1]->id)
            ->onQueue('documents'));

        return redirect()->route('admin.assistant.index', ['session' => $session->id])
            ->with('success', "{$documentModels->count()} dokumen disimpan dan sedang diproses di latar belakang.");
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
        $previewable = in_array($extension, ['pdf', 'jpg', 'jpeg', 'png', 'txt', 'csv'], true);

        if (! $previewable) {
            return $disk->download($document->storage_path, $document->original_name);
        }

        return $disk->response($document->storage_path, $document->original_name, [
            'Content-Type' => $document->mime_type ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store, max-age=0',
        ], 'inline');
    }

    public function agentProgress(Request $request, string $requestId): JsonResponse
    {
        $event = IntelligentNewsRunEvent::query()
            ->where('event_type', 'agent_run')
            ->where('payload->client_request_id', $requestId)
            ->whereIn('run_id', IntelligentNewsRun::query()->whereIn('session_id',
                IntelligentNewsSession::query()->where('created_by', $request->user()->getKey())->select('id')
            )->select('id'))->latest('id')->firstOrFail();
        try {
            $response = $this->aiClient()->timeout(5)->get(
                rtrim(config('services.apakhabar_ai.url'), '/').'/agent/runs/'.rawurlencode($event->payload['agent_run_id']),
                ['owner_id' => (string) $request->user()->getKey()],
            )->throw()->json();

            return response()->json(['status' => $response['status'], 'events' => $response['events'] ?? []]);
        } catch (\Throwable $exception) {
            return response()->json(['status' => 'unavailable', 'events' => []], 503);
        }
    }

    public function generate(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'request_id' => ['nullable', 'uuid'],
            'session_id' => ['nullable', 'integer', 'exists:intelligent_news_sessions,id'],
            'draft_id' => ['nullable', 'integer', 'exists:intelligent_news_drafts,id'],
            'information_ids' => ['nullable', 'array'],
            'information_ids.*' => ['integer', 'exists:intelligence_information,id'],
            'document_ids' => ['nullable', 'array'],
            'document_ids.*' => ['integer', 'exists:intelligence_documents,id'],
            'prompt' => ['nullable', 'string', 'max:2000'],
            'tone' => ['nullable', 'string', 'max:50'],
            'answers' => ['nullable', 'array'],
            'answers.*' => ['nullable', 'string', 'max:2000'],
        ]);

        $session = null;
        if ($validated['session_id'] ?? null) {
            $session = IntelligentNewsSession::query()
                ->where('created_by', $request->user()->getKey())
                ->findOrFail($validated['session_id']);
        }

        $documentIds = collect($validated['document_ids'] ?? $session?->selected_document_ids ?? [])
            ->map(fn ($id) => (int) $id);
        $documentIds = IntelligenceDocument::query()
            ->where('uploaded_by', $request->user()->getKey())
            ->whereNull('archived_at')
            ->whereIn('id', $documentIds)
            ->pluck('id');
        $informationIds = collect($validated['information_ids'] ?? $session?->selected_information_ids ?? [])
            ->map(fn ($id) => (int) $id);
        if ($documentIds->isNotEmpty()) {
            $informationIds = $informationIds->merge(
                IntelligenceInformation::query()
                    ->whereIn('document_id', $documentIds)
                    ->where('is_active', true)
                    ->pluck('id'),
            );
        }
        $informationIds = $informationIds->unique()->values();
        $informationIds = IntelligenceInformation::query()
            ->whereIn('id', $informationIds)
            ->whereHas('document', fn ($query) => $query
                ->where('uploaded_by', $request->user()->getKey())
                ->whereNull('archived_at'))
            ->pluck('id');

        $pendingAgentRunId = $session?->status === 'awaiting_answers'
            ? IntelligentNewsMessage::where('session_id', $session->id)
                ->where('role', 'assistant')->latest('id')->value('payload')
            : null;
        $pendingAgentRunId = data_get($pendingAgentRunId, 'agent_run_id');
        $currentDraft = isset($validated['draft_id'])
            ? IntelligentNewsDraft::where('created_by', $request->user()->getKey())
                ->where('status', 'draft')->findOrFail($validated['draft_id'])
            : null;
        $userFacts = collect($session?->user_facts ?? []);
        $submittedAnswers = collect($validated['answers'] ?? [])->filter(fn ($value) => filled($value));
        $factualAnswers = $submittedAnswers->reject(fn ($value, $field) => str_starts_with($field, 'web_source:'));
        foreach (($validated['answers'] ?? []) as $field => $value) {
            if (filled($value) && ! str_starts_with($field, 'web_source:')) {
                $userFacts = $userFacts->reject(fn ($fact) => ($fact['field'] ?? null) === $field);
                $userFacts->push(['field' => $field, 'value' => $value]);
            }
        }
        $clarificationCompleted = (bool) $session && (
            (int) $session->clarification_rounds >= 1 || $factualAnswers->isNotEmpty()
        );
        if ($session && $factualAnswers->isNotEmpty()) {
            $session->update([
                'user_facts' => $userFacts->values()->all(),
                'clarification_rounds' => 1,
            ]);
        }

        $turnPrompt = trim((string) ($validated['prompt'] ?? ''));
        $effectivePrompt = $turnPrompt;
        if ($effectivePrompt === '' && $submittedAnswers->isNotEmpty()) {
            $effectivePrompt = (string) $session?->prompt;
        }
        if ($informationIds->isEmpty() && $userFacts->isEmpty() && blank($effectivePrompt)) {
            throw ValidationException::withMessages([
                'generation' => 'Select information or a document before generating news.',
            ]);
        }

        $items = IntelligenceInformation::with('document')
            ->whereIn('id', $informationIds)
            ->where('is_active', true)
            ->where('review_status', 'approved')
            ->get();
        $unapprovedCount = IntelligenceInformation::query()
            ->whereIn('id', $informationIds)
            ->where('review_status', '!=', 'approved')
            ->count();

        if ($unapprovedCount > 0) {
            throw ValidationException::withMessages([
                'generation' => "{$unapprovedCount} informasi yang dipilih belum disetujui moderator. Tinjau informasi di Arsip Dokumen, setujui fakta yang benar, lalu kirim kembali permintaan ini.",
            ]);
        }

        if (! $session) {
            $session = IntelligentNewsSession::create([
                'created_by' => $request->user()->getKey(),
                'status' => 'ready_to_generate',
                'current_intent' => 'generate_news',
                'prompt' => $effectivePrompt,
                'selected_document_ids' => $documentIds->values()->all(),
                'selected_information_ids' => $informationIds->all(),
                'user_facts' => $userFacts->values()->all(),
                'pending_questions' => [],
                'conflicts' => [],
            ]);
        } else {
            $session->update([
                'prompt' => $turnPrompt !== '' ? $turnPrompt : $session->prompt,
                'current_intent' => 'generate_news',
                'selected_document_ids' => $documentIds->values()->all(),
                'selected_information_ids' => $informationIds->all(),
                'last_message_at' => now(),
            ]);
        }
        $answerSummary = $submittedAnswers->values()->implode(', ');
        $userMessage = IntelligentNewsMessage::create([
            'session_id' => $session->id,
            'role' => 'user',
            'intent' => ($validated['draft_id'] ?? null) ? 'revise_news' : 'generate_news',
            'content' => $turnPrompt !== ''
                ? $turnPrompt
                : ($answerSummary !== '' ? "Saya memilih: {$answerSummary}" : 'Lanjutkan permintaan ini.'),
            'payload' => [
                'information_ids' => $informationIds->all(),
                'document_ids' => $documentIds->values()->all(),
                'answers' => $validated['answers'] ?? [],
            ],
        ]);
        $run = IntelligentNewsRun::create([
            'session_id' => $session->id,
            'user_message_id' => $userMessage->id,
            'intent' => ($validated['draft_id'] ?? null) ? 'revise_news' : 'generate_news',
            'status' => 'running',
            'current_stage' => 'understanding_request',
            'started_at' => now(),
        ]);
        $selectedInformation = IntelligenceInformation::query()
            ->whereIn('id', $informationIds)
            ->get(['id', 'document_id', 'title', 'summary']);
        foreach ($selectedInformation as $source) {
            IntelligentNewsSourceSelection::create([
                'session_id' => $session->id,
                'message_id' => $userMessage->id,
                'run_id' => $run->id,
                'source_type' => 'information',
                'information_id' => $source->id,
                'document_id' => $source->document_id,
                'title' => $source->title,
                'source_snapshot' => ['summary' => $source->summary],
                'decision' => 'approved',
                'decided_by' => $request->user()->getKey(),
                'decided_at' => now(),
            ]);
        }
        $runEvent = function (string $type, string $label, string $content, ?string $tool = null) use ($run): void {
            IntelligentNewsRunEvent::create([
                'run_id' => $run->id,
                'sequence' => $run->events()->count() + 1,
                'event_type' => $type,
                'tool_name' => $tool,
                'label' => $label,
                'content' => $content,
            ]);
            $run->update(['current_stage' => $type]);
        };
        $runEvent('commentary', 'Memahami permintaan', 'Menentukan tujuan pengguna dan konteks percakapan yang relevan.');
        $runEvent('tool', 'Memeriksa sumber', $informationIds->isNotEmpty()
            ? 'Memeriksa informasi dan dokumen yang telah disetujui moderator.'
            : 'Memeriksa fakta yang tersedia dalam prompt dan percakapan.', 'source_check');

        $payload = [
            'information' => [
                'information' => $items->map(fn ($item) => [
                    'information_id' => (string) $item->id,
                    'type' => $item->type,
                    'title' => $item->title,
                    'summary' => $item->summary,
                    'labels' => $item->labels,
                    'fields' => (object) ($item->fields ?? []),
                    'evidence' => $item->evidence,
                    'confidence' => $item->confidence ?? 0,
                ])->values()->all(),
            ],
            'owner_id' => (string) $request->user()->getKey(),
            'session_id' => (string) $session->id,
            'run_id' => $validated['request_id'] ?? 'laravel-'.$run->id,
            'eligible_information_ids' => $items->pluck('id')->map(fn ($id) => (string) $id)->all(),
            'allow_web' => (bool) config('services.apakhabar_ai.web_discovery', false),
            'default_category' => NewsCategory::query()->active()->where('is_default', true)->value('name'),
            'current_draft' => $currentDraft ? array_merge($currentDraft->only([
                'headline', 'subheadline', 'lead', 'body', 'summary', 'labels', 'sources_used', 'warnings',
            ]), ['language' => 'id', 'category' => $currentDraft->category?->name]) : null,
            'language' => 'id',
            'tone' => $validated['tone'] ?? 'formal',
            'instructions' => $effectivePrompt,
            'user_facts' => $userFacts->values()->all(),
            'clarification_completed' => $clarificationCompleted,
            'available_categories' => NewsCategory::query()->active()
                ->orderBy('display_order')->orderBy('name')->pluck('name')->all(),
        ];

        try {
            $runEvent('commentary', 'Menyusun draf', 'Mengirim fakta terverifikasi dan arahan editorial ke model AI.');
            $endpoint = '/news/generate';
            if ($pendingAgentRunId && $submittedAnswers->isNotEmpty()) {
                $endpoint = '/agent/runs/'.rawurlencode($pendingAgentRunId).'/resume';
                $payload = [
                    'owner_id' => (string) $request->user()->getKey(),
                    'eligible_information_ids' => $items->pluck('id')->map(fn ($id) => (string) $id)->all(),
                    'answers' => $factualAnswers->map(fn ($value, $field) => ['field' => $field, 'value' => $value])->values()->all(),
                    'approved_web_source_ids' => $submittedAnswers
                        ->filter(fn ($value, $field) => str_starts_with($field, 'web_source:') && $value === 'Setujui')
                        ->keys()->map(fn ($field) => substr($field, strlen('web_source:')))->values()->all(),
                ];
            }
            IntelligentNewsRunEvent::create([
                'run_id' => $run->id, 'sequence' => $run->events()->count() + 1,
                'event_type' => 'agent_run', 'label' => 'Agen editorial dimulai', 'content' => 'Menjalankan alur editorial.',
                'payload' => [
                    'client_request_id' => $validated['request_id'] ?? 'laravel-'.$run->id,
                    'agent_run_id' => $pendingAgentRunId && $submittedAnswers->isNotEmpty() ? $pendingAgentRunId : $payload['run_id'],
                ],
            ]);
            $result = $this->aiClient()
                ->post(rtrim(config('services.apakhabar_ai.url'), '/').$endpoint, $payload)
                ->throw()
                ->json();
            IntelligentNewsRunEvent::create([
                'run_id' => $run->id, 'sequence' => $run->events()->count() + 1,
                'event_type' => 'agent_context', 'label' => 'Prosedur editorial tercatat', 'content' => 'Rencana dan versi keahlian disimpan untuk peninjauan.',
                'payload' => ['skills_used' => $result['skills_used'] ?? [], 'plan' => $result['plan'] ?? [], 'metrics' => $result['metrics'] ?? []],
            ]);
            foreach (($result['events'] ?? []) as $event) {
                IntelligentNewsRunEvent::create([
                    'run_id' => $run->id,
                    'sequence' => $run->events()->count() + 1,
                    'event_type' => $event['event_type'],
                    'tool_name' => $event['tool_name'] ?? null,
                    'label' => $event['label'],
                    'content' => $event['content'] ?? $event['label'],
                    'payload' => $event['payload'] ?? [],
                ]);
            }
        } catch (\Throwable $exception) {
            report($exception);
            $runEvent('error', 'Proses gagal', 'Penyedia AI tidak menyelesaikan permintaan.');
            $run->update([
                'status' => 'failed',
                'error_message' => $exception->getMessage(),
                'completed_at' => now(),
            ]);

            if ($exception instanceof RequestException && $exception->response->status() === 422) {
                $detail = $exception->response->json('detail');
                $message = is_array($detail)
                    ? collect($detail)->map(fn ($error) => data_get($error, 'msg'))->filter()->implode('; ')
                    : (string) $detail;

                return back()->withErrors([
                    'generation' => 'Permintaan ditolak karena data tidak sesuai: '.($message ?: 'payload tidak valid.'),
                ]);
            }

            $provider = config('services.apakhabar_ai.provider', 'AI lokal');

            return back()->withErrors([
                'generation' => "Layanan {$provider} belum menyelesaikan permintaan. Pastikan FastAPI dan penyedia model aktif, lalu coba lagi.",
            ]);
        }

        if ($guidance = ($result['guidance'] ?? null)) {
            $runEvent('commentary', 'Memerlukan informasi yang lebih berguna', $guidance);
            $run->update(['status' => 'completed', 'current_stage' => 'insufficient_evidence', 'completed_at' => now()]);
            $session->update(['status' => 'collecting_sources', 'pending_questions' => []]);

            return back()->withErrors(['guidance' => $guidance]);
        }

        if (! ($result['article'] ?? null)) {
            if ($clarificationCompleted && ($result['status'] ?? '') !== 'awaiting_approval') {
                return back()->withErrors([
                    'generation' => 'Klarifikasi sudah selesai, tetapi AI gagal membuat draf. Coba lagi tanpa menjawab pertanyaan tambahan.',
                ]);
            }
            $pendingQuestions = $result['completeness']['missing'] ?? [];
            if (($result['status'] ?? '') === 'awaiting_approval') {
                $pendingQuestions = collect($result['web_sources'] ?? [])->map(fn ($source) => [
                    'field' => 'web_source:'.$source['source_id'],
                    'importance' => 'required',
                    'kind' => 'unverified_subject',
                    'question' => 'Gunakan sumber ini sebagai bukti: '.$source['title'].'?',
                    'options' => ['Setujui', 'Tolak'],
                    'selection_type' => 'single',
                    'sources' => [$source],
                ])->all();
            }
            $toolCalls = $result['tool_calls'] ?? [];
            if (empty($toolCalls) && ($result['tool_call'] ?? null)) {
                $toolCalls = [$result['tool_call']];
            }
            if (! empty($toolCalls)) {
                $pendingQuestions = collect($toolCalls)->take(3)->map(
                    fn ($call, $index) => [
                        'field' => data_get($call, 'arguments.field'),
                        'importance' => 'required',
                        'kind' => data_get($pendingQuestions, "$index.kind", 'missing_fact'),
                        'reason' => data_get($call, 'arguments.lead_in'),
                        'question' => data_get($call, 'arguments.question'),
                        'options' => data_get($call, 'arguments.options', []),
                        'selection_type' => data_get($call, 'arguments.select_type', 'single'),
                        'sources' => $index === 0 ? ($result['web_sources'] ?? []) : [],
                    ]
                )->values()->all();
            }
            $session ??= new IntelligentNewsSession;
            $session->fill([
                'created_by' => $request->user()->getKey(),
                'status' => 'awaiting_answers',
                'prompt' => $validated['prompt'] ?? $session->prompt,
                'selected_document_ids' => $documentIds->values()->all(),
                'selected_information_ids' => $informationIds->all(),
                'user_facts' => $userFacts->values()->all(),
                'pending_questions' => $pendingQuestions,
                'conflicts' => $result['completeness']['conflicts'] ?? [],
            ]);
            $session->save();
            $runEvent('commentary', 'Memerlukan keputusan pengguna', 'Satu putaran klarifikasi diperlukan sebelum draf dibuat.');
            $run->update(['status' => 'awaiting_approval', 'completed_at' => now()]);

            IntelligentNewsMessage::create([
                'session_id' => $session->id,
                'role' => 'assistant',
                'intent' => 'clarification',
                'content' => 'Informasi tambahan diperlukan sebelum draf dapat dibuat.',
                'payload' => ['questions' => $pendingQuestions, 'agent_run_id' => $result['run_id'] ?? null],
            ]);

            return redirect()->route('admin.assistant.index', ['session' => $session->id]);
        }

        $article = $result['article'];
        $categoryId = $this->resolveCategoryId($article);
        [$draft, $draftVersion] = DB::transaction(function () use ($request, $validated, $article, $items, $session, $categoryId, $result) {
            $draft = isset($validated['draft_id'])
                ? IntelligentNewsDraft::query()
                    ->where('created_by', $request->user()->getKey())
                    ->where('status', 'draft')
                    ->findOrFail($validated['draft_id'])
                : new IntelligentNewsDraft;
            $nextVersion = $draft->exists ? $draft->version + 1 : 1;
            $draft->fill([
                'created_by' => $request->user()->getKey(),
                'creation_method' => 'ai',
                'category_id' => $categoryId,
                'headline' => $article['headline'],
                'subheadline' => $article['subheadline'] ?? null,
                'lead' => $article['lead'],
                'body' => $article['body'],
                'summary' => $article['summary'],
                'labels' => $article['labels'] ?? [],
                'sources_used' => $article['sources_used'] ?? [],
                'warnings' => $article['warnings'] ?? [],
                'user_prompt' => $validated['prompt'] ?? $session?->prompt,
                'version' => $nextVersion,
                'reviewed_at' => null,
            ]);
            $draft->save();
            $draft->informationSources()->sync($items->pluck('id'));
            $draftVersion = $this->storeDraftVersion(
                $draft,
                $request->user()->getKey(),
                $draft->wasRecentlyCreated ? 'generated' : 'regenerated',
                $draft->wasRecentlyCreated ? 'initial_ai' : 'ai_revision',
                $validated['prompt'] ?? null,
            );

            if ($quality = ($result['quality'] ?? null)) {
                AiQualityEvaluation::create([
                    'draft_id' => $draft->id,
                    'draft_version_id' => $draftVersion->id,
                    'evaluation_version' => $quality['evaluation_version'] ?? 'news-quality-v1',
                    'evaluator_model' => $quality['evaluator_model'] ?? null,
                    'overall_score' => $quality['quality_score'],
                    'quality_label' => $quality['quality_label'],
                    'publish_blocked' => $quality['publish_blocked'] ?? false,
                    'dimensions' => $quality['dimensions'] ?? [],
                    'claim_checks' => $quality['claim_checks'] ?? [],
                    'warnings' => $quality['warnings'] ?? [],
                ]);
            }

            return [$draft, $draftVersion];
        });

        if ($session) {
            $session->update([
                'status' => 'draft_generated',
                'user_facts' => $userFacts->values()->all(),
                'pending_questions' => [],
                'conflicts' => [],
                'draft_id' => $draft->id,
            ]);
        }

        IntelligentNewsMessage::create([
            'session_id' => $session->id,
            'role' => 'assistant',
            'intent' => 'generate_news',
            'content' => $article['headline'],
            'payload' => ['article' => $article, 'quality' => $result['quality'] ?? null],
            'draft_version_id' => $draftVersion->id,
        ]);
        $runEvent('complete', 'Draf selesai', 'Draf, sumber, dan skor kualitas telah disimpan untuk ditinjau.');
        $run->update(['status' => 'completed', 'current_stage' => 'complete', 'completed_at' => now()]);

        return redirect()->route('admin.assistant.index', [
            'draft' => $draft->id,
            'session' => $session->id,
        ]);
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

        $validated = $request->validate([
            'headline' => ['required', 'string', 'max:255'],
            'subheadline' => ['nullable', 'string', 'max:255'],
            'lead' => ['required', 'string'],
            'body' => ['required', 'array', 'min:1'],
            'body.*' => ['required', 'string'],
        ]);

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
                    'headline', 'subheadline', 'lead', 'body', 'summary', 'labels',
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
                    ['pdf', 'jpg', 'jpeg', 'png', 'txt', 'csv'],
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
