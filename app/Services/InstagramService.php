<?php

namespace App\Services;

use App\Support\PublishLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class InstagramService
{
    public function configured(): bool
    {
        return (bool) (preg_match('/^\d+$/', (string) config('services.instagram.user_id'))
            && trim((string) config('services.instagram.access_token')) !== ''
            && app(CloudinaryService::class)->configured());
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
        $extension = strtolower(pathinfo(parse_url($imageUrl, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION));
        if ($extension === 'png') {
            $imageUrl = app(InstagramImageService::class)->convertPngToJpeg($imageUrl);
        } elseif (! in_array($extension, ['jpg', 'jpeg'], true)) {
            throw ValidationException::withMessages(['platforms' => 'Instagram memerlukan gambar JPG atau PNG.']);
        }
        if (! trim($caption) || mb_strlen($caption) > 2200) {
            throw ValidationException::withMessages(['platforms' => 'Caption Instagram harus berisi 1–2200 karakter.']);
        }

        $path = parse_url($imageUrl, PHP_URL_PATH) ?: '';
        if (preg_match('~(?:^|/)(news-images/.+)$~', $path, $match)) {
            $relativePath = $match[1];
            if (str_contains('/'.$relativePath.'/', '/../') || str_contains($relativePath, '\\')) {
                throw ValidationException::withMessages(['platforms' => 'Path gambar Instagram tidak valid.']);
            }
            $disk = Storage::disk($extension === 'png' ? 'public' : config('filesystems.news_media_disk', 'public'));
            if (! $disk->exists($relativePath)) {
                throw ValidationException::withMessages(['platforms' => 'Gambar Instagram tidak ditemukan.']);
            }
            $jpeg = $disk->get($relativePath);
        } else {
            $this->validateImage($imageUrl);
            try {
                $response = Http::withoutRedirecting()->connectTimeout(5)->timeout(25)->get($imageUrl);
            } catch (ConnectionException) {
                throw ValidationException::withMessages(['platforms' => 'Gambar Instagram tidak dapat diunduh untuk disiapkan.']);
            }
            if (! $response->successful()) {
                throw ValidationException::withMessages(['platforms' => 'Gambar Instagram tidak dapat diunduh untuk disiapkan.']);
            }
            $jpeg = $response->body();
        }
        $jpeg = app(InstagramImageService::class)->normalizeJpeg($jpeg, $context);
        PublishLog::write('instagram.jpeg_verified', [...$context,
            ...app(InstagramImageService::class)->jpegMetadata($jpeg),
        ]);
        $imageUrl = app(CloudinaryService::class)->uploadJpeg($jpeg, context: $context);
        $this->validateImage($imageUrl);
        app(InstagramImageService::class)->probeCloudinary($imageUrl, $context);
        PublishLog::write('instagram.image_url', [...$context, 'image_url' => $imageUrl]);

        $creationId = $this->send('media', ['image_url' => $imageUrl, 'caption' => $caption], $context);

        return $this->send('media_publish', ['creation_id' => $creationId], $context);
    }

    private function send(string $step, array $payload, array $context): string
    {
        $url = 'https://graph.instagram.com/'.config('services.instagram.graph_version')
            .'/'.config('services.instagram.user_id').'/'.$step;
        PublishLog::write('instagram.'.$step.'.started', $context);
        if ($step === 'media') {
            PublishLog::write('instagram.media.request', [...$context,
                'parameters' => array_intersect_key($payload, array_flip(['image_url', 'caption'])),
            ]);
        }
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
