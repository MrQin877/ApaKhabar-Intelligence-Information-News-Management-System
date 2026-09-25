<?php

use App\Jobs\ProcessIntelligenceDocument;
use App\Models\IntelligenceDocument;
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
