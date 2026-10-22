<?php

namespace App\Jobs;

use App\Models\ShortVideoPublication;
use App\Services\Shorts\ReelPublisher;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PublishShortVideo implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 90;

    public function __construct(public int $publicationId)
    {
        $this->onQueue(config('shorts.queue'));
    }

    public function handle(ReelPublisher $publisher): void
    {
        // A database lease works across the local web process and Docker workers.
        $claimed = ShortVideoPublication::whereKey($this->publicationId)
            ->where(fn ($q) => $q->whereNull('locked_until')->orWhere('locked_until', '<=', now()))
            ->update(['locked_until' => now()->addSeconds(120)]);
        if (! $claimed) {
            return;
        }
        try {
            $p = ShortVideoPublication::find($this->publicationId);
            if (! $p || $p->platform === 'website' || ($p->video->status !== 'published' && ! ($p->video->status === 'archived' && $p->status === 'published' && $p->stage === 'permalink')) || ($p->status === 'published' && $p->stage === 'done') || in_array($p->status, ['failed', 'uncertain'])) {
                return;
            }
            $stage = $p->stage;
            $started = hrtime(true);
            $due = $p->next_attempt_at ?? $p->created_at;
            $p->increment('attempts');
            try {
                $publisher->step($p);
            } catch (\Throwable) {
                $p->refresh();
                if (str_ends_with($p->stage, '_inflight')) {
                    $p->update(['status' => 'uncertain', 'error_summary' => 'Hasil Meta belum pasti. Periksa status; jangan membuat publikasi baru.']);
                } elseif ($p->status !== 'failed') {
                    $p->update(['error_summary' => 'Status Meta belum dapat diperiksa. Akan dicoba kembali.']);
                }
            } finally {
                $p->refresh();
                Log::info('Short publication stage timing', [
                    'publication_id' => $p->id, 'platform' => $p->platform,
                    'stage_from' => $stage, 'stage_to' => $p->stage,
                    'status' => $p->status,
                    'execution_ms' => (int) ((hrtime(true) - $started) / 1_000_000),
                    'queue_wait_ms' => $due ? max(0, (int) ($due->diffInMilliseconds(now(), false))) : null,
                ]);
            }
            $p->refresh();
            if (in_array($p->status, ['queued', 'processing']) || ($p->status === 'published' && $p->stage === 'permalink')) {
                $p->increment('polls');
                if ($p->polls >= ($p->status === 'published' ? config('shorts.permalink_attempts', 10) : 120)) {
                    $p->update($p->status === 'published' ? ['stage' => 'done', 'error_summary' => 'Diterbitkan; tautan belum tersedia.'] : ['status' => 'failed', 'error_summary' => 'Batas pemeriksaan tercapai. Coba periksa lagi.']);
                } else {
                    $p->update(['next_attempt_at' => now()->addSeconds(self::pollDelaySeconds($p))]);
                    self::dispatch($p->id)->delay($p->next_attempt_at);
                }
            }
        } finally {
            ShortVideoPublication::whereKey($this->publicationId)->update(['locked_until' => null]);
        }
    }

    public static function pollDelaySeconds(ShortVideoPublication $p): int
    {
        $cap = (int) config('shorts.poll_seconds', 30);
        if ($p->error_summary) {
            return $cap;
        }
        if ($p->status === 'published' && $p->stage === 'permalink') {
            return min($cap, 10 * max(1, $p->polls));
        }
        if ($p->platform === 'facebook' && in_array($p->stage, ['upload', 'finish'])) {
            return 1;
        }

        return min($cap, 5 + 5 * max(0, $p->polls - 2));
    }
}
