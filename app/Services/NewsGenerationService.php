<?php

namespace App\Services;

use App\Models\AiQualityEvaluation;
use App\Models\IntelligenceDocument;
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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class NewsGenerationService
{
    public static function rules(): array
    {
        return [
            'mode' => ['nullable', 'in:auto,news'],
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
        ];
    }

    public function generate(int $userId, array $validated): array
    {

        if (($validated['mode'] ?? 'news') === 'auto') {
            $conversation = app(AssistantConversationService::class)->respond($userId, $validated);
            if ($conversation !== null) {
                return $conversation;
            }
        }

        $session = null;
        if ($validated['session_id'] ?? null) {
            $session = IntelligentNewsSession::query()
                ->where('created_by', $userId)
                ->findOrFail($validated['session_id']);
        }

        $documentIds = collect($validated['document_ids'] ?? $session?->selected_document_ids ?? [])
            ->map(fn ($id) => (int) $id);
        $documentIds = IntelligenceDocument::query()
            ->where('uploaded_by', $userId)
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
                ->where('uploaded_by', $userId)
                ->whereNull('archived_at'))
            ->pluck('id');

        $pendingAgentRunId = $session?->status === 'awaiting_answers'
            ? IntelligentNewsMessage::where('session_id', $session->id)
                ->where('role', 'assistant')->latest('id')->value('payload')
            : null;
        $pendingAgentRunId = data_get($pendingAgentRunId, 'agent_run_id');
        $currentDraft = isset($validated['draft_id'])
            ? IntelligentNewsDraft::where('created_by', $userId)
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
                'created_by' => $userId,
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
                // Freeze the exact approved evidence used by this turn, not mutable library records.
                'information_attachments' => $items->map(fn ($item) => [
                    'id' => $item->id,
                    'document_id' => $item->document_id,
                    'title' => $item->title,
                    'summary' => $item->summary,
                    'labels' => $item->labels ?? [],
                    'evidence' => $item->evidence ?? [],
                    'document' => ['id' => $item->document_id, 'original_name' => $item->document->original_name],
                ])->values()->all(),
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
                'decided_by' => $userId,
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
            'owner_id' => (string) $userId,
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
                    'owner_id' => (string) $userId,
                    'eligible_information_ids' => $items->pluck('id')->map(fn ($id) => (string) $id)->all(),
                    'answers' => $factualAnswers->map(fn ($value, $field) => ['field' => $field, 'value' => $value])->values()->all(),
                    'approved_web_source_ids' => $submittedAnswers
                        ->filter(fn ($value, $field) => str_starts_with($field, 'web_source:') && $value === 'Setujui')
                        ->keys()->map(fn ($field) => substr($field, strlen('web_source:')))->values()->all(),
                ];
            }
            $runEvent('source_loading', 'Membaca dokumen asli', 'Membaca ulang file sumber untuk verifikasi draf.');
            $payload['original_documents'] = (object) $this->originalDocuments($items);
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

                return ['errors' => [
                    'generation' => 'Permintaan ditolak karena data tidak sesuai: '.($message ?: 'payload tidak valid.'),
                ]];
            }

            $provider = config('services.apakhabar_ai.provider', 'AI lokal');

            return ['errors' => [
                'generation' => "Layanan {$provider} belum menyelesaikan permintaan. Pastikan FastAPI dan penyedia model aktif, lalu coba lagi.",
            ]];
        }

        if ($guidance = ($result['guidance'] ?? null)) {
            $runEvent('commentary', 'Memerlukan informasi yang lebih berguna', $guidance);
            $run->update(['status' => 'completed', 'current_stage' => 'insufficient_evidence', 'completed_at' => now()]);
            $session->update(['status' => 'collecting_sources', 'pending_questions' => []]);

            return ['errors' => ['guidance' => $guidance]];
        }

        if (! ($result['article'] ?? null)) {
            if ($clarificationCompleted && ($result['status'] ?? '') !== 'awaiting_approval') {
                return ['errors' => [
                    'generation' => 'Klarifikasi sudah selesai, tetapi AI gagal membuat draf. Coba lagi tanpa menjawab pertanyaan tambahan.',
                ]];
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
                'created_by' => $userId,
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

            return ['url' => route('admin.assistant.index', ['session' => $session->id], false)];
        }

        $article = $result['article'];
        $categoryId = $this->resolveCategoryId($article);
        [$draft, $draftVersion] = DB::transaction(function () use ($userId, $validated, $article, $items, $session, $categoryId, $result) {
            $draft = isset($validated['draft_id'])
                ? IntelligentNewsDraft::query()
                    ->where('created_by', $userId)
                    ->where('status', 'draft')
                    ->findOrFail($validated['draft_id'])
                : new IntelligentNewsDraft;
            $nextVersion = $draft->exists ? $draft->version + 1 : 1;
            $draft->fill([
                'created_by' => $userId,
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
                $userId,
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
        $proposal = $article['category_proposal'] ?? null;
        if ($proposal && filled($proposal['name'] ?? null) && filled($proposal['reason'] ?? null)
            && mb_strlen($proposal['name']) <= 100 && mb_strlen($proposal['reason']) <= 1000
            && ! NewsCategory::whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower(trim($proposal['name']))])->exists()) {
            $session->messages()->create([
                'role' => 'assistant', 'intent' => 'category_proposal',
                'content' => 'Kategori baru diusulkan: '.trim($proposal['name']),
                'payload' => ['category_proposal' => ['name' => trim($proposal['name']), 'reason' => $proposal['reason'],
                    'draft_id' => $draft->id, 'draft_version' => $draft->version, 'status' => 'pending']],
            ]);
        }
        $runEvent('complete', 'Draf selesai', 'Draf, sumber, dan skor kualitas telah disimpan untuk ditinjau.');
        $run->update(['status' => 'completed', 'current_stage' => 'complete', 'completed_at' => now()]);

        return ['url' => route('admin.assistant.index', [
            'draft' => $draft->id,
            'session' => $session->id,
        ], false)];
    }

    private function originalDocuments($items): array
    {
        $originals = [];
        foreach ($items->groupBy('document_id') as $group) {
            $document = $group->first()->document;
            try {
                $disk = Storage::disk($document->storage_disk);
                if (! $disk->exists($document->storage_path) || $disk->size($document->storage_path) > 20 * 1024 * 1024) {
                    continue;
                }
                // Read only owner-scoped, selected approved sources, never a model-supplied path.
                $normalized = $this->aiClient()->attach('file', $disk->get($document->storage_path), $document->original_name)
                    ->post(rtrim(config('services.apakhabar_ai.url'), '/').'/documents/upload')
                    ->throw()->json();
                foreach ($group as $item) {
                    $originals[(string) $item->id] = $normalized;
                }
            } catch (\Throwable $exception) {
                // Missing originals must yield a review flag, never a false verification pass.
                report($exception);
            }
        }

        return $originals;
    }

    private function aiClient(): PendingRequest
    {
        $timeout = min(1200, max(1, (int) config('services.apakhabar_ai.timeout', 1200)));
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
        $proposedName = mb_strtolower(trim((string) data_get($article, 'category_proposal.name', '')));
        if ($proposedName !== '' && ($existing = $categories->first(fn ($category) => mb_strtolower(trim($category->name)) === $proposedName))) {
            return (int) $existing->getKey();
        }
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
}
