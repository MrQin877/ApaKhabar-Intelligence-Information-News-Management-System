<?php

namespace App\Services;

use App\Services\News\MetaCredentials;
use App\Support\PublishLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class FacebookPublishingService
{
    public function configured(): bool
    {
        return (bool) (preg_match('/^\d+$/', (string) app(MetaCredentials::class)->forPlatform('facebook')['id'])
            && trim((string) app(MetaCredentials::class)->forPlatform('facebook')['token']) !== ''
            && preg_match('/^v\d+\.\d+$/', (string) config('services.facebook.graph_version')));
    }

    public function publish(?string $imageUrl, string $message, array $context = []): string
    {
        if (! $this->configured()) {
            throw ValidationException::withMessages(['platforms' => 'Halaman Facebook belum dikonfigurasi. Hubungi administrator.']);
        }
        if (! trim($message)) {
            throw ValidationException::withMessages(['platforms' => 'Teks Facebook tidak boleh kosong.']);
        }

        $credentials = app(MetaCredentials::class)->forPlatform('facebook');
        $step = $imageUrl ? 'photos' : 'feed';
        $payload = $imageUrl
            ? ['url' => $this->imageUrl($imageUrl, $context), 'caption' => $message]
            : ['message' => $message];
        $url = 'https://graph.facebook.com/'.config('services.facebook.graph_version')
            .'/'.$credentials['id'].'/'.$step;
        PublishLog::write('facebook.'.$step.'.started', $context);
        try {
            // Do not retry: a timed-out publish may already have succeeded.
            $response = Http::asForm()->connectTimeout(5)->timeout(25)->post($url, [
                ...$payload, 'access_token' => $credentials['token'],
            ]);
        } catch (ConnectionException) {
            PublishLog::write('facebook.'.$step.'.failure', [...$context, 'reason' => 'connection_failed',
                'endpoint' => $url, 'step' => $step, 'http_status' => null,
            ], 'error', 'single');
            throw ValidationException::withMessages(['platforms' => 'Status penerbitan Facebook belum dapat dipastikan. Periksa Halaman Facebook sebelum mencoba lagi.']);
        }

        $id = $response->json('post_id') ?? $response->json('id');
        if (! $response->successful() || ! is_scalar($id) || ! preg_match('/^\d+(?:_\d+)?$/', (string) $id)) {
            $code = (int) $response->json('error.code', 0);
            PublishLog::write('facebook.'.$step.'.failure', [...$context,
                'http_status' => $response->status(), 'error_code' => $code,
                'endpoint' => $url, 'step' => $step,
                'error_message' => 'Meta rejected the publishing request',
                'error_type' => $response->json('error.type'),
                'error_subcode' => $response->json('error.error_subcode'),
                'fbtrace_id' => $response->json('error.fbtrace_id'),
            ], 'error', 'single');
            throw ValidationException::withMessages(['platforms' => match ($code) {
                190, 102 => 'Token Halaman Facebook tidak valid atau kedaluwarsa. Hubungi administrator.',
                10, 200 => 'Izin penerbitan Halaman Facebook belum tersedia. Hubungi administrator.',
                default => 'Penerbitan Facebook gagal. Periksa Halaman Facebook dan gambar sebelum mencoba lagi.',
            }]);
        }

        PublishLog::write('facebook.'.$step.'.success', [...$context, 'http_status' => $response->status(), 'post_id' => (string) $id]);

        return (string) $id;
    }

    private function imageUrl(string $url, array $context): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        if (preg_match('~(?:^|/)(news-images/.+)$~', $path, $match)) {
            $path = $match[1];
            if (str_contains('/'.$path.'/', '/../') || str_contains($path, '\\')) {
                throw ValidationException::withMessages(['platforms' => 'Path gambar Facebook tidak valid.']);
            }
            $disk = Storage::disk(config('filesystems.news_media_disk', 'public'));
            if (! $disk->exists($path)) {
                throw ValidationException::withMessages(['platforms' => 'Gambar Facebook tidak ditemukan.']);
            }
            // Reuse JPEG preparation without applying Instagram's square normalization.
            try {
                if (in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), ['png', 'webp'], true)) {
                    $prepared = app(InstagramImageService::class)->convertPngToJpeg($url);
                    $bytes = $disk->get('news-images/instagram/'.basename(parse_url($prepared, PHP_URL_PATH)));
                } else {
                    $bytes = $disk->get($path);
                }
                $url = app(CloudinaryService::class)->uploadJpeg($bytes, context: $context);
            } catch (ValidationException) {
                throw ValidationException::withMessages(['platforms' => 'Gambar Facebook gagal disiapkan atau diunggah ke Cloudinary. Periksa gambar dan konfigurasi Cloudinary.']);
            }
        }
        $host = strtolower(trim((string) parse_url($url, PHP_URL_HOST), '[]'));
        if (! filter_var($url, FILTER_VALIDATE_URL) || ! in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true)
            || parse_url($url, PHP_URL_USER) !== null || parse_url($url, PHP_URL_PASS) !== null
            || ! str_contains($host, '.') || $host === 'localhost' || preg_match('/\.(localhost|local|test|internal|invalid)$/', $host)
            || (filter_var($host, FILTER_VALIDATE_IP) && ! filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE))) {
            throw ValidationException::withMessages(['platforms' => 'Facebook memerlukan URL gambar publik.']);
        }

        return $url;
    }
}
