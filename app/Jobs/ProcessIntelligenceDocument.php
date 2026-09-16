<?php

namespace App\Jobs;

use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
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

    public function __construct(public int $documentId) {}

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
        if ($document->status === 'ready') {
            return;
        }

        $document->update([
            'status' => 'processing',
            'embedding_status' => 'pending',
            'error_message' => null,
            'processing_attempts' => $document->processing_attempts + 1,
            'last_attempted_at' => now(),
        ]);

        $result = $this->client()
            ->attach(
                'files',
                Storage::disk($document->storage_disk)->get($document->storage_path),
                $document->original_name,
            )
            ->post(rtrim(config('services.apakhabar_ai.url'), '/').'/documents/batch-extract')
            ->throw()
            ->json('results.0');

        if (($result['status'] ?? null) !== 'ready' || empty($result['extraction']['information'])) {
            throw new \RuntimeException($result['error'] ?? 'No information was extracted.');
        }

        DB::transaction(function () use ($document, $result): void {
            $document->information()->delete();
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
                'error_message' => null,
                'processed_at' => now(),
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
    }

    private function client(): PendingRequest
    {
        return Http::acceptJson()
            ->connectTimeout(max(1, (int) config('services.apakhabar_ai.connect_timeout', 5)))
            ->timeout(max(1, (int) config('services.apakhabar_ai.timeout', 180)));
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
