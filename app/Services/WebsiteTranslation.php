<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class WebsiteTranslation
{
    private bool $cacheFailureReported = false;

    private function cacheFailure(string $operation, Throwable $exception): void
    {
        if (! $this->cacheFailureReported) {
            Log::warning('Website translation cache unavailable.', [
                'operation' => $operation,
                'exception' => $exception::class,
            ]);
            $this->cacheFailureReported = true;
        }
    }

    public function translate(array $texts, string $target): array
    {
        $cache = Cache::store(config('translation.cache_store'));
        $result = [];
        $missing = [];
        foreach ($texts as $index => $text) {
            $key = 'translation:v1:'.hash('sha256', config('translation.url').'|'.$target.'|'.$text);
            try {
                $value = $cache->get($key);
            } catch (Throwable $exception) {
                $this->cacheFailure('read', $exception);
                $value = null;
            }
            if (is_string($value)) {
                $result[$index] = $value;
            } else {
                $missing[$index] = ['key' => $key, 'text' => $text];
            }
        }
        if ($missing !== []) {
            $payload = ['q' => array_column(array_values($missing), 'text'), 'source' => 'auto', 'target' => $target, 'format' => 'text'];
            if (config('translation.api_key')) {
                $payload['api_key'] = config('translation.api_key');
            }
            $response = Http::acceptJson()->connectTimeout(3)->timeout(config('translation.timeout'))
                ->post(rtrim(config('translation.url'), '/').'/translate', $payload)->throw();
            $translations = $response->json('translatedText');
            if (! is_array($translations) || count($translations) !== count($missing) || count(array_filter($translations, 'is_string')) !== count($missing)) {
                throw new RuntimeException('Invalid translation response.');
            }
            foreach (array_keys($missing) as $offset => $index) {
                $result[$index] = $translations[$offset];
                try {
                    $cache->put($missing[$index]['key'], $result[$index], config('translation.cache_seconds'));
                } catch (Throwable $exception) {
                    // Cache availability must not discard valid upstream translations.
                    $this->cacheFailure('write', $exception);
                }
            }
        }
        ksort($result);

        return array_values($result);
    }
}
