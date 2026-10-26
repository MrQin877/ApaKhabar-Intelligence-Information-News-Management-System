<?php

namespace App\Services\Shorts;

use App\Services\CloudinaryService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CloudinaryVideoService
{
    public function upload(UploadedFile $file): array
    {
        if (! app(CloudinaryService::class)->configured()) {
            throw ValidationException::withMessages(['video' => 'Cloudinary belum dikonfigurasi.']);
        }
        $params = ['public_id' => 'apakhabar/shorts/'.Str::uuid(), 'timestamp' => (string) now()->timestamp];
        ksort($params);
        $signature = hash('sha256', urldecode(http_build_query($params)).config('services.cloudinary.api_secret'));
        $stream = fopen($file->getRealPath(), 'rb');
        $started = hrtime(true);
        try {
            $r = Http::connectTimeout(10)->timeout(180)->attach('file', $stream, 'short.mp4', ['Content-Type' => 'video/mp4'])
                ->post('https://api.cloudinary.com/v1_1/'.config('services.cloudinary.cloud_name').'/video/upload', [...$params, 'api_key' => config('services.cloudinary.api_key'), 'signature' => $signature]);
            $data = $r->json();
            if (! $r->successful() || ($data['resource_type'] ?? '') !== 'video' || ($data['format'] ?? '') !== 'mp4' || ! is_string($data['public_id'] ?? null)) {
                throw new \RuntimeException;
            }
            $this->assertUrl($data['secure_url'] ?? '');
            Log::info('Short Cloudinary upload timing', [
                'duration_ms' => (int) ((hrtime(true) - $started) / 1_000_000),
                'bytes' => $file->getSize(),
            ]);

            return $data;
        } catch (\Throwable) {
            throw ValidationException::withMessages(['video' => 'Unggahan Cloudinary gagal. Periksa koneksi, batas akun, dan konfigurasi.']);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    public function assertUrl(string $url): void
    {
        if (parse_url($url, PHP_URL_SCHEME) !== 'https' || parse_url($url, PHP_URL_HOST) !== 'res.cloudinary.com' || ! str_starts_with(parse_url($url, PHP_URL_PATH) ?: '', '/'.config('services.cloudinary.cloud_name').'/')) {
            throw new \RuntimeException('URL Cloudinary tidak valid.');
        }
    }

    public function frame(string $publicId, float $offset): string
    {
        return 'https://res.cloudinary.com/'.config('services.cloudinary.cloud_name').'/video/upload/so_'.number_format($offset, 3, '.', '').',f_jpg/'.implode('/', array_map('rawurlencode', explode('/', $publicId))).'.jpg';
    }

    public function cover(?UploadedFile $file, string $publicId, float $offset): array
    {
        if (! $file) {
            return ['url' => $this->frame($publicId, $offset), 'public_id' => null];
        }
        $image = @imagecreatefromstring(file_get_contents($file->getRealPath()));
        if (! $image) {
            throw ValidationException::withMessages(['cover' => 'Sampul tidak valid.']);
        }
        $canvas = imagecreatetruecolor(imagesx($image), imagesy($image));
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagecopy($canvas, $image, 0, 0, 0, 0, imagesx($image), imagesy($image));
        ob_start();
        imagejpeg($canvas, null, 90);
        $jpeg = ob_get_clean();
        imagedestroy($image);
        imagedestroy($canvas);

        return ['url' => app(CloudinaryService::class)->uploadJpeg($jpeg), 'public_id' => null];
    }
}
