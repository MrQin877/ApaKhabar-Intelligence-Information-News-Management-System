<?php

use App\Jobs\ProcessIntelligenceDocument;
use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(function (): void {
    IntelligenceDocument::query()
        ->where('status', 'processing')
        ->where(function ($query) {
            $query->whereNull('last_attempted_at')
                ->orWhere('last_attempted_at', '<', now()->subMinutes(5));
        })
        ->pluck('id')
        ->each(fn (int $id) => ProcessIntelligenceDocument::dispatch($id)->onQueue('documents'));
})->everyMinute()->name('resume-stalled-intelligence-documents')->withoutOverlapping();

Schedule::call(function (): void {
    IntelligenceDocument::query()
        ->whereNull('archived_at')
        ->whereNotNull('archive_after')
        ->where('archive_after', '<=', now())
        ->each(function (IntelligenceDocument $document): void {
            $document->update(['archived_at' => now()]);
            $document->information()->update(['is_active' => false]);
        });
})->daily()->name('archive-expired-intelligence-documents')->withoutOverlapping();

Artisan::command('ai:reindex-approved {--owner= : Limit to one owner ID}', function () {
    $client = Http::acceptJson()->timeout(config('services.apakhabar_ai.timeout', 1200));
    if ($token = config('services.apakhabar_ai.token')) {
        $client->withHeaders(['X-ApaKhabar-Service-Token' => $token]);
    }
    $indexed = 0;
    IntelligenceInformation::query()->with('document')
        ->where('review_status', 'approved')->where('is_active', true)
        ->whereHas('document', function ($query) {
            $query->whereNull('archived_at');
            if ($owner = $this->option('owner')) {
                $query->where('uploaded_by', $owner);
            }
        })->chunkById(50, function ($items) use ($client, &$indexed) {
            $client->post(rtrim(config('services.apakhabar_ai.url'), '/').'/rag/information/index', [
                'items' => $items->map(fn ($item) => [
                    'information_id' => (string) $item->id,
                    'document_id' => (string) $item->document_id,
                    'owner_id' => (string) $item->document->uploaded_by,
                    'title' => $item->title, 'summary' => $item->summary,
                    'labels' => $item->labels ?? [], 'fields' => (object) ($item->fields ?? []),
                    'evidence' => $item->evidence ?? [], 'source' => $item->document->original_name,
                    'review_status' => 'approved', 'is_active' => true, 'archived' => false,
                ])->all(),
            ])->throw();
            IntelligenceInformation::whereIn('id', $items->pluck('id'))->update(['information_embedding_status' => 'ready']);
            $indexed += $items->count();
        });
    $this->info("Indexed {$indexed} approved information records.");
})->purpose('Rebuild approved AI knowledge after an embedding model or agent collection migration');
