<?php

namespace App\Jobs;

use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
use App\Models\IntelligenceExtractionRequest;
use App\Models\IntelligentNewsSession;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ProcessIntelligenceDocument implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    public int $timeout = 210;

    public int $uniqueFor = 600;

    public function __construct(
        public int $documentId,
        public ?int $extractionRequestId = null,
    ) {}

    public function uniqueId(): string
    {
        return "intelligence-document:{$this->documentId}";
    }

    public function backoff(): array
    {
        return [10, 30, 60, 120];
    }

    public function middleware(): array
    {
        return [(new WithoutOverlapping($this->uniqueId()))->releaseAfter(10)->expireAfter(300)];
    }

    public function handle(): void
    {
        $document = IntelligenceDocument::findOrFail($this->documentId);
        $extractionRequest = $this->extractionRequestId
            ? IntelligenceExtractionRequest::findOrFail($this->extractionRequestId)
            : $document->extractionRequests()->latest()->first();
        if ($document->status === 'ready' && ! $extractionRequest) {
            return;
        }

        $extractionRequest?->update([
            'status' => 'processing',
            'started_at' => now(),
            'error_message' => null,
        ]);

        $document->update([
            'status' => 'processing',
            'embedding_status' => 'pending',
            'error_message' => null,
            'processing_attempts' => $document->processing_attempts + 1,
            'last_attempted_at' => now(),
        ]);

        $request = $this->client()->attach(
                'files',
                Storage::disk($document->storage_disk)->get($document->storage_path),
                $document->original_name,
            );
        $result = $request->post(
                rtrim(config('services.apakhabar_ai.url'), '/').'/documents/batch-extract',
                [
                    'extraction_mode' => $extractionRequest?->mode ?? 'general',
                    'extraction_query' => $extractionRequest?->normalized_query,
                    'keywords_json' => json_encode($extractionRequest?->keywords ?? []),
                ],
            )
            ->throw()
            ->json('results.0');

        if (($result['status'] ?? null) !== 'ready' || empty($result['extraction']['information'])) {
            throw new \RuntimeException($result['error'] ?? 'No information was extracted.');
        }

        DB::transaction(function () use ($document, $extractionRequest, $result): void {
            if ($extractionRequest) {
                $extractionRequest->information()->delete();
            } else {
                $document->information()->delete();
            }
            foreach ($result['extraction']['information'] as $index => $item) {
                $quality = $this->extractionQuality($item);
                IntelligenceInformation::create([
                    'document_id' => $document->id,
                    'extraction_request_id' => $extractionRequest?->id,
                    'item_index' => $index,
                    'type' => $item['type'],
                    'title' => $item['title'],
                    'summary' => $item['summary'],
                    'labels' => $item['labels'] ?? [],
                    'fields' => $item['fields'] ?? [],
                    'evidence' => $item['evidence'] ?? [],
                    'confidence' => $item['confidence'] ?? null,
                    'quality_score' => $quality['score'],
                    'quality_breakdown' => $quality['dimensions'],
                    'review_status' => 'pending',
                    'information_embedding_status' => 'pending',
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
                'error_message' => null,
                'processed_at' => now(),
            ]);
            $extractionRequest?->update([
                'status' => 'completed',
                'completed_at' => now(),
                'error_message' => null,
            ]);
        });

        $this->refreshWaitingSessions();
    }

    public function failed(?Throwable $exception): void
    {
        IntelligenceDocument::whereKey($this->documentId)->update([
            'status' => 'failed',
            'embedding_status' => 'failed',
            'error_message' => $exception?->getMessage() ?? 'Document processing failed.',
        ]);
        if ($this->extractionRequestId) {
            IntelligenceExtractionRequest::whereKey($this->extractionRequestId)->update([
                'status' => 'failed',
                'error_message' => $exception?->getMessage() ?? 'Extraction failed.',
                'completed_at' => now(),
            ]);
        }
    }

    private function client(): PendingRequest
    {
        return Http::acceptJson()
            ->connectTimeout(max(1, (int) config('services.apakhabar_ai.connect_timeout', 5)))
            ->timeout(max(1, (int) config('services.apakhabar_ai.timeout', 180)));
    }

    /**
     * This is an explainable quality estimate, not ground-truth accuracy.
     * Human approval remains required before information enters the searchable library.
     */
    private function extractionQuality(array $item): array
    {
        $evidence = collect($item['evidence'] ?? [])->filter(
            fn ($entry) => filled($entry['source'] ?? null) && filled($entry['quote'] ?? null),
        );
        $evidenceScore = min(100, $evidence->count() * 50);
        $required = ['title', 'summary', 'type'];
        $present = collect($required)->filter(fn ($field) => filled($item[$field] ?? null))->count();
        $completenessScore = round(($present / count($required)) * 100, 2);
        $modelConfidence = round(max(0, min(1, (float) ($item['confidence'] ?? 0))) * 100, 2);
        $score = round(
            ($evidenceScore * 0.40) + ($completenessScore * 0.30) + ($modelConfidence * 0.30),
            2,
        );

        return [
            'score' => $score,
            'dimensions' => [
                'evidence_coverage' => $evidenceScore,
                'completeness' => $completenessScore,
                'model_confidence' => $modelConfidence,
            ],
        ];
    }

    private function refreshWaitingSessions(): void
    {
        IntelligentNewsSession::where('status', 'processing_files')
            ->get()
            ->filter(fn (IntelligentNewsSession $session) => in_array(
                $this->documentId,
                array_map('intval', $session->selected_document_ids ?? []),
                true,
            ))
            ->each(function (IntelligentNewsSession $session): void {
                $statuses = IntelligenceDocument::whereIn('id', $session->selected_document_ids ?? [])
                    ->pluck('status');

                if ($statuses->isNotEmpty() && $statuses->every(fn (string $status) => $status === 'ready')) {
                    $session->update(['status' => 'ready_to_generate']);
                }
            });
    }
}
