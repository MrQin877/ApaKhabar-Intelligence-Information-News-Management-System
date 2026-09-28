<?php

namespace App\Services;

use App\Support\PublishLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class CloudinaryService
{
    public function configured(): bool
    {
        return preg_match('/^[a-zA-Z0-9_-]+$/', (string) config('services.cloudinary.cloud_name'))
            && trim((string) config('services.cloudinary.api_key')) !== ''
            && trim((string) config('services.cloudinary.api_secret')) !== '';
    }

    /** Upload JPEG bytes, or a public JPEG URL, using a backend-only signature. */
    public function uploadJpeg(string $file, bool $isUrl = false, array $context = []): string
    {
        // Only carry correlation fields into logs; never log payloads or provider bodies.
        $context = array_intersect_key($context, array_flip(['attempt_id', 'draft_id', 'selected_platforms']));
        $failure = function (string $reason, array $details = []) use ($context): never {
            PublishLog::write('cloudinary.failure', [...$context, 'reason' => $reason, ...$details], 'error');
            throw ValidationException::withMessages(['platforms' => 'Gambar Instagram gagal diunggah ke Cloudinary. Periksa konfigurasi atau coba lagi nanti.']);
        };
        if (! $this->configured()) {
            $failure('configuration_missing');
        }

        $timestamp = (string) now()->timestamp;
        $payload = [
            'format' => 'jpg',
            'timestamp' => $timestamp,
            'api_key' => config('services.cloudinary.api_key'),
            'signature' => hash('sha256', 'format=jpg&timestamp='.$timestamp.config('services.cloudinary.api_secret')),
        ];
        $request = Http::connectTimeout(5)->timeout(60);
        if ($isUrl) {
            $request = $request->asForm();
            $payload['file'] = $file;
        } else {
            $request = $request->attach('file', $file, 'instagram.jpg', ['Content-Type' => 'image/jpeg']);
        }

        try {
            $response = $request->post('https://api.cloudinary.com/v1_1/'.config('services.cloudinary.cloud_name').'/image/upload', $payload);
        } catch (ConnectionException) {
            $failure('connection_failed');
        }

        $url = $response->json('secure_url');
        if (! $response->successful()) {
            $failure('upload_rejected', ['http_status' => $response->status()]);
        }
        if (! is_string($url) || ! filter_var($url, FILTER_VALIDATE_URL)
            || parse_url($url, PHP_URL_SCHEME) !== 'https'
            || parse_url($url, PHP_URL_USER) !== null || parse_url($url, PHP_URL_PASS) !== null) {
            $failure('invalid_secure_url', ['http_status' => $response->status()]);
        }

        if ($response->json('resource_type') !== 'image' || ! in_array($response->json('format'), ['jpg', 'jpeg'], true)) {
            $failure('invalid_image_format', ['http_status' => $response->status()]);
        }
        PublishLog::write('cloudinary.success', [...$context, 'http_status' => $response->status(), 'secure_url' => $url,
            'resource_type' => $response->json('resource_type'), 'format' => $response->json('format'),
        ]);

        return $url;
    }
}
