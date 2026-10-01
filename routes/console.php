<?php

use App\Jobs\ProcessIntelligenceDocument;
use App\Models\IntelligenceDocument;
use App\Services\PublicationPreviewFiles;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
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

Artisan::command('news:cleanup-publication-previews', function () {
    $removed = app(PublicationPreviewFiles::class)->cleanup();
    $this->info("Removed {$removed} expired publication preview directories.");
})->purpose('Remove expired, unreferenced publication preview images')->hourly()->withoutOverlapping();
