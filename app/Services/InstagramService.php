<?php

namespace App\Services;

use App\Support\PublishLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class InstagramService
{
    public function configured(): bool
    {
        $base = trim((string) config('services.instagram.public_base_url'));
        try {
            $this->validateImage($base);
        } catch (ValidationException) {
            return false;
        }
        $parts = parse_url($base);

        return (bool) (preg_match('/^\d+$/', (string) config('services.instagram.user_id'))
            && trim((string) config('services.instagram.access_token')) !== ''
            && in_array($parts['path'] ?? '', ['', '/'], true)
            && ! isset($parts['query']) && ! isset($parts['fragment']));
    }

    public function publicImageUrl(string $imageUrl): string
    {
        $parts = parse_url($imageUrl);
        $host = strtolower(trim($parts['host'] ?? '', '[]'));
        $local = $host === 'localhost' || str_ends_with($host, '.localhost')
            || (filter_var($host, FILTER_VALIDATE_IP)
                && ! filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE));

        if ($local && in_array($parts['scheme'] ?? '', ['http', 'https'], true)
            && ! isset($parts['user']) && ! isset($parts['pass'])) {
            $imageUrl = rtrim((string) config('services.instagram.public_base_url'), '/')
                .($parts['path'] ?? '/')
                .(isset($parts['query']) ? '?'.$parts['query'] : '')
                .(isset($parts['fragment']) ? '#'.$parts['fragment'] : '');
        }

        $this->validateImage($imageUrl);

        return $imageUrl;
    }

    public function validateImage(?string $imageUrl): void
    {
        $parts = parse_url($imageUrl ?? '');
        $host = strtolower(trim($parts['host'] ?? '', '[]'));
        $publicIp = filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
        if (! filter_var($imageUrl, FILTER_VALIDATE_URL)
            || ! in_array($parts['scheme'] ?? '', ['http', 'https'], true)
            || isset($parts['user']) || isset($parts['pass'])
            || ! $host || $host === 'localhost' || ! str_contains($host, '.') && ! $publicIp
            || preg_match('/\.(localhost|local|test|internal|invalid)$/', $host)
            || (filter_var($host, FILTER_VALIDATE_IP) && ! $publicIp)) {
            throw ValidationException::withMessages(['platforms' => 'Instagram memerlukan URL gambar publik. Gunakan domain HTTPS publik atau penyimpanan publik, bukan localhost atau alamat jaringan lokal.']);
        }
    }

    /** Returns the published Instagram media ID; credentials never leave the backend. */
    public function publish(string $imageUrl, string $caption, array $context = []): string
    {
        if (! $this->configured()) {
            Log::warning('Instagram publishing configuration is missing or invalid.');
            throw ValidationException::withMessages(['platforms' => 'Akun Instagram belum dikonfigurasi. Hubungi administrator.']);
        }
        $imageUrl = $this->publicImageUrl($imageUrl);
        PublishLog::write('instagram.image_url', [...$context, 'image_url' => $imageUrl]);
        if (! trim($caption) || mb_strlen($caption) > 2200) {
            throw ValidationException::withMessages(['platforms' => 'Caption Instagram harus berisi 1–2200 karakter.']);
        }

        $creationId = $this->send('media', ['image_url' => $imageUrl, 'caption' => $caption], $context);

        return $this->send('media_publish', ['creation_id' => $creationId], $context);
    }

    private function send(string $step, array $payload, array $context): string
    {
        $url = 'https://graph.instagram.com/'.config('services.instagram.graph_version')
            .'/'.config('services.instagram.user_id').'/'.$step;
        PublishLog::write('instagram.'.$step.'.started', $context);
        try {
            // Never automatically retry publishing: a timed-out request may have succeeded.
            $response = Http::asForm()->connectTimeout(5)->timeout(25)->post($url, [
                ...$payload, 'access_token' => config('services.instagram.access_token'),
            ]);
        } catch (ConnectionException $exception) {
            PublishLog::write('instagram.'.$step.'.failure', [...$context, 'exception' => $exception::class, 'exception_message' => $exception->getMessage()], 'error');
            throw ValidationException::withMessages(['platforms' => $step === 'media_publish'
                ? 'Status penerbitan Instagram belum dapat dipastikan. Periksa akun Instagram sebelum mencoba lagi.'
                : 'Instagram tidak dapat dihubungi. Silakan coba lagi nanti.']);
        }

        $id = $response->json('id');
        $responseContext = [...$context, 'http_status' => $response->status(), 'response_body' => $response->json() ?? $response->body()];
        if (! $response->successful() || ! is_scalar($id) || ! preg_match('/^\d+$/', (string) $id)) {
            PublishLog::write('instagram.'.$step.'.failure', $responseContext, 'error');
            $message = match ((int) $response->json('error.code', 0)) {
                190, 102 => 'Token Instagram tidak valid atau kedaluwarsa. Hubungi administrator untuk memperbaruinya.',
                10, 200 => 'Izin penerbitan Instagram belum tersedia. Hubungi administrator.',
                default => $step === 'media'
                    ? 'Gambar Instagram gagal disiapkan. Pastikan gambar JPEG dapat diakses publik dan memenuhi persyaratan Instagram.'
                    : 'Berita gagal diterbitkan ke Instagram. Periksa akun Instagram sebelum mencoba lagi.',
            };
            throw ValidationException::withMessages(['platforms' => $message]);
        }

        PublishLog::write('instagram.'.$step.'.success', $responseContext);

        return (string) $id;
    }
}
