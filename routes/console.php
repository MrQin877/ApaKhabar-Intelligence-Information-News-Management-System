<?php

use App\Jobs\ProcessIntelligenceDocument;
use App\Jobs\PublishShortVideo;
use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
use App\Models\ShortVideoPublication;
use App\Services\PublicationPreviewFiles;
use App\Services\Shorts\PublicationPermalink;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('shorts:recover-facebook-permalinks {--id= : Publication record ID}', function () {
    $normalized = 0;
    $queued = 0;
    ShortVideoPublication::where('platform', 'facebook')->where('status', 'published')
        ->when($this->option('id'), fn ($q, $id) => $q->whereKey($id))
        ->whereHas('video', fn ($q) => $q->whereIn('status', ['published', 'archived']))
        ->chunkById(100, function ($rows) use (&$normalized, &$queued) {
            foreach ($rows as $row) {
                DB::transaction(function () use ($row, &$normalized, &$queued) {
                    $p = ShortVideoPublication::whereKey($row->id)->lockForUpdate()->first();
                    if (! $p || $p->status !== 'published' || ($p->locked_until && $p->locked_until->isFuture())) {
                        return;
                    }
                    $url = PublicationPermalink::normalize('facebook', $p->permalink);
                    if ($url) {
                        if ($url !== $p->permalink) {
                            $p->update(['permalink' => $url, 'stage' => 'done', 'error_summary' => null]);
                            $normalized++;
                        }

                        return;
                    }
                    if (! $p->media_id || $p->stage === 'permalink') {
                        return;
                    }
                    $p->update(['permalink' => null, 'stage' => 'permalink', 'polls' => 0, 'next_attempt_at' => now(), 'error_summary' => 'Diterbitkan; tautan sedang diperiksa.']);
                    DB::afterCommit(fn () => PublishShortVideo::dispatch($p->id));
                    $queued++;
                });
            }
        });
    $this->info("Tautan dinormalisasi: {$normalized}; pemeriksaan dijadwalkan: {$queued}.");
})->purpose('Recover Facebook Reel URLs using saved provider paths or read-only metadata jobs');

Schedule::call(function (): void {
    IntelligenceDocument::query()
        ->where('status', 'processing')
        ->where(function ($query) {
            $query->whereNull('last_attempted_at')
                ->orWhere(
                    'last_attempted_at',
                    '<',
                    now()->subMinutes(25),
                );
        })
        ->pluck('id')
        ->each(
            fn (int $id) => ProcessIntelligenceDocument::dispatch($id)
                ->onQueue('documents'),
        );
})
    ->everyMinute()
    ->name('resume-stalled-intelligence-documents')
    ->withoutOverlapping();

Artisan::command('news:cleanup-publication-previews', function () {
    $removed = app(PublicationPreviewFiles::class)->cleanup();

    $this->info(
        "Removed {$removed} expired publication preview directories.",
    );
})
    ->purpose('Remove expired, unreferenced publication preview images')
    ->hourly()
    ->withoutOverlapping();

Schedule::call(function (): void {
    IntelligenceDocument::query()
        ->whereNull('archived_at')
        ->whereNotNull('archive_after')
        ->where('archive_after', '<=', now())
        ->each(function (IntelligenceDocument $document): void {
            $document->update(['archived_at' => now()]);
            $document->information()->update(['is_active' => false]);
        });
})
    ->daily()
    ->name('archive-expired-intelligence-documents')
    ->withoutOverlapping();

Artisan::command(
    'ai:reindex-approved {--owner= : Limit to one owner ID}',
    function () {
        $client = Http::acceptJson()
            ->timeout(config('services.apakhabar_ai.timeout', 1200));

        if ($token = config('services.apakhabar_ai.token')) {
            $client->withHeaders([
                'X-ApaKhabar-Service-Token' => $token,
            ]);
        }

        $indexed = 0;

        IntelligenceInformation::query()
            ->with('document')
            ->where('review_status', 'approved')
            ->where('is_active', true)
            ->whereHas('document', function ($query) {
                $query->whereNull('archived_at');

                if ($owner = $this->option('owner')) {
                    $query->where('uploaded_by', $owner);
                }
            })
            ->chunkById(50, function ($items) use ($client, &$indexed) {
                $client->post(
                    rtrim(config('services.apakhabar_ai.url'), '/')
                        .'/rag/information/index',
                    [
                        'items' => $items->map(fn ($item) => [
                            'information_id' => (string) $item->id,
                            'document_id' => (string) $item->document_id,
                            'owner_id' => (string) $item->document->uploaded_by,
                            'title' => $item->title,
                            'summary' => $item->summary,
                            'labels' => $item->labels ?? [],
                            'fields' => (object) ($item->fields ?? []),
                            'evidence' => $item->evidence ?? [],
                            'source' => $item->document->original_name,
                            'review_status' => 'approved',
                            'is_active' => true,
                            'archived' => false,
                        ])->all(),
                    ],
                )->throw();

                IntelligenceInformation::whereIn('id', $items->pluck('id'))
                    ->update(['information_embedding_status' => 'ready']);

                $indexed += $items->count();
            });

        $this->info("Indexed {$indexed} approved information records.");
    },
)->purpose(
    'Rebuild approved AI knowledge after an embedding model or agent collection migration',
);

Schedule::call(function () {
    DB::table('news_viewers')->where('expires_at', '<', now())->delete();
    DB::table('news_visits')->where('expires_at', '<', now())->delete();
})->daily()->name('engagement-retention')->withoutOverlapping();

// Recover committed video publications when queue dispatch or a worker was interrupted.
Schedule::call(function (): void {
    ShortVideoPublication::where(fn ($q) => $q->whereIn('status', ['queued', 'processing'])->orWhere(fn ($q) => $q->where('status', 'published')->where('stage', 'permalink')))
        ->where('platform', '!=', 'website')->where('updated_at', '<', now()->subMinutes(3))
        ->whereHas('video', fn ($q) => $q->where('status', 'published')->whereNull('deleted_at'))
        ->where(fn ($q) => $q->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
        ->chunkById(100, function ($rows) {
            foreach ($rows as $row) {
                PublishShortVideo::dispatch($row->id);
            }
        });
})->everyMinute()->name('recover-short-publications')->withoutOverlapping();
