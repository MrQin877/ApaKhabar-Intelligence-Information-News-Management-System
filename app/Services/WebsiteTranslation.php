<?php

namespace App\Services;

use Illuminate\Contracts\Cache\LockTimeoutException;
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

    public function translate(array $texts, string $target, string $source = 'auto'): array
    {
        if ($source === $target) {
            return array_values($texts);
        }
        $unique = array_values(array_unique($texts));
        if (count($unique) !== count($texts)) {
            $translated = $this->translate($unique, $target, $source);

            return array_map(fn ($text) => $translated[array_search($text, $unique, true)], array_values($texts));
        }

        return $this->translateCached($texts, $target, $source);
    }

    private function withInferenceLock(array $texts, string $target, string $source): array
    {
        try {
            $lock = Cache::store('file')->lock('website-translation-inference', config('translation.timeout') + 15);
            // Cache hits never wait. Cold requests queue instead of failing on
            // normal overlap, then re-read the cache to coalesce duplicate work.
            $lock->block(config('translation.lock_wait', 50));
        } catch (LockTimeoutException $exception) {
            throw new RuntimeException('Translation service is busy.', 0, $exception);
        } catch (Throwable $exception) {
            $this->cacheFailure('lock', $exception);

            return $this->translateCached($texts, $target, $source, true);
        }
        try {
            return $this->translateCached($texts, $target, $source, true);
        } finally {
            try {
                $lock->release();
            } catch (Throwable $exception) {
                $this->cacheFailure('unlock', $exception);
            }
        }
    }

    private function translateCached(array $texts, string $target, string $source, bool $locked = false): array
    {
        $cache = Cache::store(config('translation.cache_store'));
        $result = [];
        $missing = [];
        foreach ($texts as $index => $text) {
            $key = 'translation:v2:'.hash('sha256', config('translation.url').'|'.$source.'|'.$target.'|'.$text);
            try {
                $value = $cache->get($key);
            } catch (Throwable $exception) {
                $this->cacheFailure('read', $exception);
                $value = null;
            }
            if (is_string($value) && trim($value) !== '') {
                $result[$index] = $value;
            } else {
                $missing[$index] = ['key' => $key, 'text' => $text];
            }
        }
        if ($missing !== []) {
            if (! $locked) {
                return $this->withInferenceLock($texts, $target, $source);
            }
            $payload = ['q' => array_column(array_values($missing), 'text'), 'source' => $source, 'target' => $target, 'format' => 'text'];
            if (config('translation.api_key')) {
                $payload['api_key'] = config('translation.api_key');
            }
            $response = Http::acceptJson()->connectTimeout(3)->timeout(config('translation.timeout'))
                ->post(rtrim(config('translation.url'), '/').'/translate', $payload)->throw();
            $translations = $response->json('translatedText');
            if (! is_array($translations) || ! array_is_list($translations) || count($translations) !== count($missing) || count(array_filter($translations, fn ($value) => is_string($value) && trim($value) !== '')) !== count($missing)) {
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
