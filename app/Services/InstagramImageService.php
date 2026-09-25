<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class InstagramImageService
{
    /** Create a separate public JPEG variant for Instagram while preserving the source image. */
    public function convertPngToPublicJpeg(string $imageUrl): string
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

        return rtrim((string) config('services.instagram.public_base_url'), '/').'/storage/'.$destination;
    }
}
