<?php

namespace App\Jobs;

use App\Models\IntelligentNewsRun;
use App\Models\User;
use App\Services\NewsGenerationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Throwable;

class GenerateIntelligentNews implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 1250;

    public bool $failOnTimeout = true;

    public function __construct(public int $userId, public array $input) {}

    public static function cacheKey(int $userId, string $requestId): string
    {
        return 'news-generation:'.$userId.':'.$requestId;
    }

    public function handle(NewsGenerationService $service): void
    {
        $key = self::cacheKey($this->userId, $this->input['request_id']);
        // Duplicate deliveries must never create a second draft version.
        $lock = Cache::lock($key.':lock', 1300);
        if (! $lock->get()) {
            return;
        }
        try {
            if (in_array(Cache::get($key)['status'] ?? '', ['completed', 'failed'], true)) {
                return;
            }
            User::findOrFail($this->userId);
            Cache::put($key, ['status' => 'running', 'events' => []], now()->addDay());
            $result = $service->generate($this->userId, $this->input);
            if (isset($result['errors'])) {
                $this->markRunFailed();
            }
            Cache::put($key, [
                'status' => isset($result['errors']) ? 'failed' : 'completed',
                'events' => [], ...$result,
            ], now()->addDay());
        } catch (ValidationException $exception) {
            $this->markRunFailed();
            Cache::put($key, ['status' => 'failed', 'events' => [], 'errors' => $exception->errors()], now()->addDay());
        } finally {
            $lock->release();
        }
    }

    public function failed(?Throwable $exception): void
    {
        $this->markRunFailed();
        Cache::put(self::cacheKey($this->userId, $this->input['request_id']), [
            'status' => 'failed', 'events' => [],
            'errors' => ['generation' => 'Proses AI gagal atau melewati batas waktu. Periksa layanan AI lalu coba lagi.'],
        ], now()->addDay());
    }

    private function markRunFailed(): void
    {
        IntelligentNewsRun::query()->where('status', 'running')
            ->whereHas('session', fn ($query) => $query->where('created_by', $this->userId))
            ->whereHas('events', fn ($query) => $query->where('event_type', 'agent_run')
                ->where('payload->client_request_id', $this->input['request_id']))
            ->update(['status' => 'failed', 'current_stage' => 'error', 'completed_at' => now()]);
    }
}
