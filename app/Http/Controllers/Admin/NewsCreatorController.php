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
use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsSession;
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

        return inertia('admin/intelligentnewscreator/newscreator-agent', [
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

        try {
            $pending = Http::timeout(config('services.apakhabar_ai.timeout'));
            foreach ($documents as $document) {
                $pending = $pending->attach(
                    'files',
                    Storage::disk($document->storage_disk)->get($document->storage_path),
                    $document->original_name,
                );
            }
            $results = $pending
                ->post(rtrim(config('services.apakhabar_ai.url'), '/').'/documents/batch-extract')
                ->throw()
                ->json('results', []);

            foreach ($documents->values() as $position => $document) {
                $result = $results[$position] ?? ['status' => 'failed', 'error' => 'No result returned.'];
                if (($result['status'] ?? null) !== 'ready' || empty($result['extraction']['information'])) {
                    $document->update([
                        'status' => 'failed',
                        'embedding_status' => 'failed',
                        'error_message' => $result['error'] ?? 'No information was extracted.',
                    ]);

                    continue;
                }

                DB::transaction(function () use ($document, $result): void {
                    foreach ($result['extraction']['information'] as $index => $item) {
                        IntelligenceInformation::create([
                            'document_id' => $document->id,
                            'item_index' => $index,
                            'type' => $item['type'],
                            'title' => $item['title'],
                            'summary' => $item['summary'],
                            'labels' => $item['labels'] ?? [],
                            'fields' => $item['fields'] ?? [],
                            'evidence' => $item['evidence'] ?? [],
                            'confidence' => $item['confidence'] ?? null,
                            'search_text' => implode(' ', [
                                $item['title'], $item['summary'],
                                json_encode($item['labels'] ?? []),
                                json_encode($item['fields'] ?? []),
                            ]),
                        ]);
                    }

                    $document->update([
                        'ai_document_id' => $result['document']['document_id'] ?? null,
                        'character_count' => $result['document']['character_count'] ?? null,
                        'status' => 'ready',
                        'embedding_status' => ($result['chunks_indexed'] ?? 0) > 0 ? 'ready' : 'failed',
                        'processed_at' => now(),
                    ]);
                });
            }
        } catch (\Throwable $exception) {
            $documents->each->update([
                'status' => 'failed', 'embedding_status' => 'failed',
                'error_message' => $exception->getMessage(),
            ]);
            report($exception);

            return back()->withErrors([
                'document' => 'The document was saved, but AI extraction failed. Check the AI service and OCR configuration.',
            ]);
        }

        $ready = $documents->filter(fn ($document) => $document->fresh()->status === 'ready')->count();

        if (filled($validated['prompt'] ?? null) && $ready > 0) {
            $readyIds = $documents->filter(fn ($document) => $document->status === 'ready')->pluck('id');
            $documentIds = $readyIds->merge($validated['document_ids'] ?? [])->unique();
            $informationIds = collect($validated['information_ids'] ?? [])->merge(
                IntelligenceInformation::query()->whereIn('document_id', $documentIds)->pluck('id'),
            )->unique();

            return redirect()->route('admin.creator.create', [
                'documents' => $documentIds->join(','),
                'information' => $informationIds->join(','),
                'prompt' => $validated['prompt'],
                'fact' => $validated['manual_fact'] ?? null,
                'generate' => 1,
            ]);
        }

        return back()->with('success', "$ready of {$documents->count()} documents processed successfully.");
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
        foreach (($validated['answers'] ?? []) as $field => $value) {
            if (filled($value)) {
                $userFacts = $userFacts->reject(fn ($fact) => ($fact['field'] ?? null) === $field);
                $userFacts->push(['field' => $field, 'value' => $value]);
            }
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
        ];

        try {
            $result = Http::timeout(config('services.apakhabar_ai.timeout'))
                ->post(rtrim(config('services.apakhabar_ai.url'), '/').'/news/generate', $payload)
                ->throw()
                ->json();
        } catch (\Throwable $exception) {
            report($exception);

            return back()->withErrors(['generation' => 'The AI news service is unavailable.']);
        }

        if (! ($result['article'] ?? null)) {
            $session ??= new IntelligentNewsSession;
            $session->fill([
                'created_by' => $request->user()->getKey(),
                'status' => 'awaiting_answers',
                'prompt' => $validated['prompt'] ?? $session->prompt,
                'selected_document_ids' => $documentIds->values()->all(),
                'selected_information_ids' => $informationIds->all(),
                'user_facts' => $userFacts->values()->all(),
                'pending_questions' => $result['completeness']['missing'] ?? [],
                'conflicts' => $result['completeness']['conflicts'] ?? [],
            ]);
            $session->save();

            return redirect()->route('admin.creator.create', ['session' => $session->id]);
        }

        $article = $result['article'];
        $draft = DB::transaction(function () use ($request, $validated, $article, $items, $session) {
            $draft = IntelligentNewsDraft::create([
                'created_by' => $request->user()->getKey(),
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

        $response = Http::timeout(config('services.apakhabar_ai.timeout'))
            ->post(rtrim(config('services.apakhabar_ai.url'), '/').'/rag/search', [
                'query' => $validated['query'],
                'top_k' => 8,
            ])
            ->throw()
            ->json('results', []);

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
                'category' => 'Information',
                'extract' => $document->information->map(fn ($item) => [
                    'year' => data_get($item->fields, 'date', 'Information'),
                    'text' => $item->title.' — '.$item->summary,
                ])->values(),
            ]);

        return Inertia::render('admin/intelligentnewscreator/docarchive', [
            'documents' => $documents,
        ]);
    }
}
