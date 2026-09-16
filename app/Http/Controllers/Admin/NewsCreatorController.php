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
use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsSession;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class NewsCreatorController extends Controller
{
    public function documents(): Response
    {
        return $this->renderArchive();
    }

    public function create(Request $request): Response
    {
        $information = IntelligenceInformation::query()
            ->with('document:id,original_name,status')
            ->where('is_active', true)
            ->latest()
            ->limit(200)
            ->get();

        $generatedArticle = null;
        if ($draftId = $request->integer('draft')) {
            $draft = IntelligentNewsDraft::query()
                ->with('informationSources.document')
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
                    'sources_used' => $draft->sources_used,
                    'warnings' => $draft->warnings,
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
            ->where('status', 'ready')
            ->latest()
            ->limit(200)
            ->get(['id', 'original_name', 'status', 'created_at']);

        $newsSession = null;
        if ($sessionId = $request->integer('session')) {
            $newsSession = IntelligentNewsSession::query()
                ->where('created_by', $request->user()->getKey())
                ->find($sessionId);
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
        ]);
    }

    public function storeDocument(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'documents' => ['required', 'array', 'min:1', 'max:5'],
            'documents.*' => ['required', 'file', 'max:20480', 'mimes:pdf,jpg,jpeg,png,docx,xlsx,xlsm,csv,txt'],
            'prompt' => ['nullable', 'string', 'max:2000'],
            'manual_fact' => ['nullable', 'string', 'max:2000'],
            'information_ids' => ['nullable', 'array'],
            'information_ids.*' => ['integer', 'exists:intelligence_information,id'],
            'document_ids' => ['nullable', 'array'],
            'document_ids.*' => ['integer', 'exists:intelligence_documents,id'],
        ]);
        $disk = config('filesystems.default');
        $documents = collect($validated['documents'])->map(function ($file) use ($request, $disk) {
            $path = $file->store('intelligence-documents', $disk);
            if (! $path) {
                throw new \RuntimeException("Unable to store {$file->getClientOriginalName()} on the {$disk} disk.");
            }

            return IntelligenceDocument::create([
                'uploaded_by' => $request->user()->getKey(),
                'original_name' => $file->getClientOriginalName(),
                'storage_disk' => $disk,
                'storage_path' => $path,
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'sha256' => hash_file('sha256', $file->getRealPath()),
                'status' => 'processing',
                'embedding_status' => 'pending',
            ]);
        });

        $documents->each(fn (IntelligenceDocument $document) => ProcessIntelligenceDocument::dispatch($document->id)
            ->onQueue('documents'));

        if (filled($validated['prompt'] ?? null)) {
            $session = IntelligentNewsSession::create([
                'created_by' => $request->user()->getKey(),
                'status' => 'processing_files',
                'prompt' => $validated['prompt'],
                'selected_document_ids' => $documents->pluck('id')
                    ->merge($validated['document_ids'] ?? [])->unique()->values()->all(),
                'selected_information_ids' => collect($validated['information_ids'] ?? [])->unique()->values()->all(),
                'user_facts' => filled($validated['manual_fact'] ?? null)
                    ? [['field' => 'additional_context', 'value' => $validated['manual_fact']]]
                    : [],
                'pending_questions' => [],
                'conflicts' => [],
            ]);

            return redirect()->route('admin.creator.create', ['session' => $session->id])
                ->with('success', 'Dokumen disimpan dan sedang diproses di latar belakang.');
        }

        return back()->with('success', "{$documents->count()} dokumen masuk antrean pemrosesan.");
    }

    public function retryDocument(IntelligenceDocument $document): RedirectResponse
    {
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

    public function generate(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'session_id' => ['nullable', 'integer', 'exists:intelligent_news_sessions,id'],
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

        $userFacts = collect($session?->user_facts ?? []);
        $submittedAnswers = collect($validated['answers'] ?? [])->filter(fn ($value) => filled($value));
        foreach (($validated['answers'] ?? []) as $field => $value) {
            if (filled($value)) {
                $userFacts = $userFacts->reject(fn ($fact) => ($fact['field'] ?? null) === $field);
                $userFacts->push(['field' => $field, 'value' => $value]);
            }
        }
        $clarificationCompleted = (bool) $session && (
            (int) $session->clarification_rounds >= 1 || $submittedAnswers->isNotEmpty()
        );
        if ($session && $submittedAnswers->isNotEmpty()) {
            $session->update([
                'user_facts' => $userFacts->values()->all(),
                'clarification_rounds' => 1,
            ]);
        }

        $effectivePrompt = $validated['prompt'] ?? $session?->prompt;
        if ($informationIds->isEmpty() && $userFacts->isEmpty() && blank($effectivePrompt)) {
            throw ValidationException::withMessages([
                'generation' => 'Select information or a document before generating news.',
            ]);
        }

        $items = IntelligenceInformation::with('document')
            ->whereIn('id', $informationIds)
            ->where('is_active', true)
            ->get();

        $payload = [
            'information' => [
                'information' => $items->map(fn ($item) => [
                    'type' => $item->type,
                    'title' => $item->title,
                    'summary' => $item->summary,
                    'labels' => $item->labels,
                    'fields' => $item->fields,
                    'evidence' => $item->evidence,
                    'confidence' => $item->confidence ?? 0,
                ])->values()->all(),
            ],
            'language' => 'id',
            'tone' => $validated['tone'] ?? 'formal',
            'instructions' => $effectivePrompt,
            'user_facts' => $userFacts->values()->all(),
            'clarification_completed' => $clarificationCompleted,
        ];

        try {
            $result = $this->aiClient()
                ->post(rtrim(config('services.apakhabar_ai.url'), '/').'/news/generate', $payload)
                ->throw()
                ->json();
        } catch (\Throwable $exception) {
            report($exception);

            return back()->withErrors([
                'generation' => 'Layanan AI tidak merespons dalam batas waktu. Pastikan FastAPI dan Ollama sedang berjalan, lalu coba lagi.',
            ]);
        }

        if (! ($result['article'] ?? null)) {
            if ($clarificationCompleted) {
                return back()->withErrors([
                    'generation' => 'Klarifikasi sudah selesai, tetapi AI gagal membuat draf. Coba lagi tanpa menjawab pertanyaan tambahan.',
                ]);
            }
            $pendingQuestions = $result['completeness']['missing'] ?? [];
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

            return redirect()->route('admin.creator.create', ['session' => $session->id]);
        }

        $article = $result['article'];
        $draft = DB::transaction(function () use ($request, $validated, $article, $items, $session) {
            $draft = IntelligentNewsDraft::create([
                'created_by' => $request->user()->getKey(),
                'creation_method' => 'ai',
                'headline' => $article['headline'],
                'subheadline' => $article['subheadline'] ?? null,
                'lead' => $article['lead'],
                'body' => $article['body'],
                'summary' => $article['summary'],
                'labels' => $article['labels'] ?? [],
                'sources_used' => $article['sources_used'] ?? [],
                'warnings' => $article['warnings'] ?? [],
                'user_prompt' => $validated['prompt'] ?? $session?->prompt,
            ]);
            $draft->informationSources()->attach($items->pluck('id'));

            return $draft;
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

        return redirect()->route('admin.creator.create', ['draft' => $draft->id]);
    }

    public function recommend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'max:2000'],
        ]);

        try {
            $response = $this->aiClient()
                ->post(rtrim(config('services.apakhabar_ai.url'), '/').'/rag/search', [
                    'query' => $validated['query'],
                    'top_k' => 8,
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

        $documents = IntelligenceDocument::query()
            ->whereIn('ai_document_id', collect($response)->pluck('document_id')->unique())
            ->get()
            ->keyBy('ai_document_id');

        $recommendations = collect($response)->map(function ($result) use ($documents) {
            $document = $documents->get($result['document_id']);
            if (! $document) {
                return null;
            }

            return [
                'document_id' => $document->id,
                'name' => $document->original_name,
                'source' => $result['source'],
                'excerpt' => $result['content'],
                'distance' => $result['distance'],
            ];
        })->filter()->unique('document_id')->values();

        return response()->json(['recommendations' => $recommendations]);
    }

    public function archive(): Response
    {
        return $this->renderArchive();
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

        return Http::acceptJson()
            ->connectTimeout($connectTimeout)
            ->timeout($timeout);
    }

    private function renderArchive(): Response
    {
        $documents = IntelligenceDocument::query()
            ->with('information:id,document_id,title,summary,fields')
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
                'status' => $document->status,
                'error' => $document->error_message,
                'attempts' => $document->processing_attempts,
                'category' => 'Information',
                'extract' => $document->information->map(fn ($item) => [
                    'year' => data_get($item->fields, 'date', 'Information'),
                    'text' => $item->title.' — '.$item->summary,
                ])->values(),
            ]);

        return Inertia::render('admin/intelligentnewscreator/documents', [
            'documents' => $documents,
        ]);
    }
}
