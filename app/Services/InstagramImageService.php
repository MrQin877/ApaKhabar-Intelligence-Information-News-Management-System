<?php

namespace App\Services;

use App\Support\PublishLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class InstagramImageService
{
    public function jpegMetadata(string $bytes): array
    {
        $info = @getimagesizefromstring($bytes);
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $decoded = $info !== false && ($info[2] ?? null) === IMAGETYPE_JPEG
            ? @imagecreatefromstring($bytes) : false;
        if ($mime !== 'image/jpeg' || $decoded === false) {
            throw ValidationException::withMessages(['platforms' => 'Media Instagram bukan berkas JPEG yang valid.']);
        }
        imagedestroy($decoded);

        return ['mime' => $mime, 'width' => $info[0], 'height' => $info[1],
            'bits' => $info['bits'] ?? null, 'channels' => $info['channels'] ?? null,
            'bytes' => strlen($bytes)];
    }

    /** GET verifies the actual delivered bytes; redirects are deliberately rejected. */
    public function probeCloudinary(string $url, array $context = []): void
    {
        try {
            $response = Http::withoutRedirecting()->connectTimeout(5)->timeout(25)
                ->withHeaders(['Accept' => 'image/jpeg', 'User-Agent' => 'ApaKhabar-Media-Probe/1.0'])
                ->get($url);
        } catch (ConnectionException) {
            PublishLog::write('instagram.cloudinary_probe', [...$context, 'image_url' => $url,
                'http_status' => null, 'valid' => false, 'reason' => 'connection_failed'], 'error');
            throw ValidationException::withMessages(['platforms' => 'URL Cloudinary tidak dapat diperiksa. Silakan coba lagi nanti.']);
        }

        $metadata = null;
        try {
            $metadata = $this->jpegMetadata($response->body());
        } catch (ValidationException) {
            // Log metadata only, never the downloaded body (which could be an error page).
        }
        $finalUrl = (string) ($response->effectiveUri() ?? $url);
        $contentType = strtolower(trim(explode(';', $response->header('Content-Type'))[0]));
        $supportedSizes = array_map(
            fn (string $type) => NewsImageCropService::outputSize('instagram', ['type' => $type]),
            ['portrait', 'square', 'landscape'],
        );
        $valid = $response->status() === 200 && $contentType === 'image/jpeg'
            && $response->header('Location') === '' && $finalUrl === $url
            && $metadata !== null && in_array([$metadata['width'], $metadata['height']], $supportedSizes, true);
        PublishLog::write('instagram.cloudinary_probe', [...$context, 'image_url' => $url,
            'http_status' => $response->status(), 'content_type' => $response->header('Content-Type'),
            'content_length' => $response->header('Content-Length'), 'final_url' => $finalUrl,
            'redirect_location' => $response->header('Location'), 'redirects_followed' => 0,
            'metadata' => $metadata, 'valid' => $valid,
        ], $valid ? 'info' : 'error');
        if (! $valid) {
            throw ValidationException::withMessages(['platforms' => 'URL Cloudinary harus mengembalikan HTTP 200 dan JPEG dengan ukuran potongan Instagram yang didukung ('.implode(', ', array_map(fn (array $size) => implode('x', $size), $supportedSizes)).') langsung tanpa pengalihan.']);
        }
    }

    /** Fit the entire image on a white square without changing its proportions. */
    public function normalizeJpeg(string $source, array $context = []): string
    {
        $image = false;
        $canvas = false;
        $bufferLevel = ob_get_level();
        try {
            $image = @imagecreatefromstring($source);
            if ($image === false) {
                throw new \RuntimeException('Invalid image.');
            }
            $width = imagesx($image);
            $height = imagesy($image);
            $size = 1080;
            $scale = $size / max($width, $height);
            $fitWidth = max(1, (int) round($width * $scale));
            $fitHeight = max(1, (int) round($height * $scale));
            $canvas = imagecreatetruecolor($size, $size);
            imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
            if (! imagecopyresampled($canvas, $image, (int) floor(($size - $fitWidth) / 2),
                (int) floor(($size - $fitHeight) / 2), 0, 0, $fitWidth, $fitHeight, $width, $height)) {
                throw new \RuntimeException('Unable to resize image.');
            }
            ob_start();
            $encoded = imagejpeg($canvas, null, 95);
            $bytes = ob_get_clean();
            if (! $encoded || ! is_string($bytes) || $bytes === '') {
                throw new \RuntimeException('Unable to encode image.');
            }
        } catch (\Throwable) {
            throw ValidationException::withMessages(['platforms' => 'Gambar Instagram gagal disiapkan sebagai JPEG persegi. Periksa gambar dan dukungan GD.']);
        } finally {
            while (ob_get_level() > $bufferLevel) {
                ob_end_clean();
            }
            if ($image !== false) {
                imagedestroy($image);
            }
            if ($canvas !== false) {
                imagedestroy($canvas);
            }
        }

        PublishLog::write('instagram.image_normalized', [...$context,
            'original_width' => $width, 'original_height' => $height,
            'final_width' => $size, 'final_height' => $size,
        ]);

        return $bytes;
    }

    /** Create a separate stored JPEG variant for Instagram while preserving the source image. */
    public function convertPngToJpeg(string $imageUrl): string
    {
        $path = parse_url($imageUrl, PHP_URL_PATH);
        if (! is_string($path) || ! preg_match('~(?:^|/)(news-images/.+)$~', $path, $match)) {
            throw ValidationException::withMessages(['platforms' => 'Gambar PNG Instagram harus tersimpan pada penyimpanan berita.']);
        }

        $relativePath = $match[1];
        if (str_contains('/'.$relativePath.'/', '/../') || str_contains($relativePath, '\\')) {
            throw ValidationException::withMessages(['platforms' => 'Gambar PNG Instagram harus tersimpan pada penyimpanan berita.']);
        }
        $sourceDisk = Storage::disk(config('filesystems.news_media_disk', 'public'));
        if (! $relativePath || ! $sourceDisk->exists($relativePath)) {
            throw ValidationException::withMessages(['platforms' => 'Gambar PNG tidak ditemukan untuk disiapkan bagi Instagram.']);
        }

        $source = $sourceDisk->get($relativePath);
        if (! is_string($source) || ! function_exists('imagecreatefromstring') || ! function_exists('imagejpeg')) {
            throw ValidationException::withMessages(['platforms' => 'Konversi gambar PNG untuk Instagram tidak tersedia.']);
        }

        try {
            $image = @imagecreatefromstring($source);
        } catch (\Throwable) {
            $image = false;
        }
        if ($image === false) {
            throw ValidationException::withMessages(['platforms' => 'Gambar PNG gagal dikonversi ke JPEG untuk Instagram.']);
        }

        try {
            $width = imagesx($image);
            $height = imagesy($image);
            $jpeg = imagecreatetruecolor($width, $height);
            if ($jpeg === false) {
                throw new \RuntimeException('Unable to allocate JPEG canvas.');
            }

            $white = imagecolorallocate($jpeg, 255, 255, 255);
            imagefill($jpeg, 0, 0, $white);
            imagecopy($jpeg, $image, 0, 0, 0, 0, $width, $height);

            ob_start();
            $encoded = imagejpeg($jpeg, null, 90);
            $jpegBytes = ob_get_clean();
            imagedestroy($jpeg);
            if (! $encoded || ! is_string($jpegBytes) || $jpegBytes === '') {
                throw new \RuntimeException('Unable to encode JPEG image.');
            }
        } catch (\Throwable) {
            throw ValidationException::withMessages(['platforms' => 'Gambar PNG gagal dikonversi ke JPEG untuk Instagram.']);
        } finally {
            imagedestroy($image);
        }

        $destination = 'news-images/instagram/'.hash('sha256', $source).'.jpg';
        if (! Storage::disk('public')->put($destination, $jpegBytes)) {
            throw ValidationException::withMessages(['platforms' => 'JPEG Instagram gagal disimpan pada penyimpanan publik.']);
        }

        return '/storage/'.$destination;
    }
}
