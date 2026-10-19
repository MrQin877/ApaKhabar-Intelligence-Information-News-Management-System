<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class NewsImageCropService
{
    public const SIZES = ['website' => [1600, 900], 'instagram' => [1080, 1080], 'facebook' => [1200, 630]];

    public static function outputSize(string $platform, array $crop): array
    {
        if ($platform === 'website' || ! isset($crop['type'])) {
            return self::SIZES[$platform];
        }

        return match ($crop['type']) {
            'portrait' => [1080, 1350],
            'square' => [1080, 1080],
            'landscape' => $platform === 'instagram' ? [1080, 566] : [1200, 630],
        };
    }

    // Must match image-crops.ts, including integer rounding and edge clamping.
    public static function cropRectangle(int $width, int $height, string $platform, array $crop): array
    {
        [$outWidth, $outHeight] = self::outputSize($platform, $crop);
        $ratio = $outWidth / $outHeight;
        $w = max(1, (int) round(min($width, $height * $ratio) / $crop['zoom']));
        $h = max(1, (int) round(min($height, $width / $ratio) / $crop['zoom']));

        return ['width' => $w, 'height' => $h,
            'x' => (int) round(max(0, min($width - $w, $crop['x'] * $width - $w / 2))),
            'y' => (int) round(max(0, min($height - $h, $crop['y'] * $height - $h / 2)))];
    }

    public function generate(string $url, array $settings, string $directory = 'news-images/crops'): array
    {
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        if (! preg_match('~(?:^|/)(news-images/.+)$~', $path, $match)
            || str_contains($path, '..') || str_contains($path, '\\')) {
            throw ValidationException::withMessages(['image_crops' => 'Unggah gambar terlebih dahulu untuk menyesuaikan potongannya.']);
        }
        $disk = Storage::disk(config('filesystems.news_media_disk', 'public'));
        if (! $disk->exists($match[1])) {
            throw ValidationException::withMessages(['image_crops' => 'Gambar asli tidak ditemukan. Silakan unggah kembali.']);
        }
        $bytes = $disk->get($match[1]);
        $info = @getimagesizefromstring($bytes);
        // Bound decoding memory, including small compressed files with huge dimensions.
        if (! $info || $info[0] * $info[1] > 24000000) {
            throw ValidationException::withMessages(['image_crops' => 'Gunakan gambar dengan resolusi maksimal 24 megapiksel.']);
        }
        $source = @imagecreatefromstring($bytes);
        if (! $source) {
            throw ValidationException::withMessages(['image_crops' => 'Gambar tidak dapat diproses. Gunakan JPG atau PNG yang valid.']);
        }
        try {
            if ($info[2] === IMAGETYPE_JPEG) {
                $source = NewsImageOptimizer::orientJpeg($source, $bytes);
            }
            $width = imagesx($source);
            $height = imagesy($source);
            $variants = [];
            foreach (self::SIZES as $platform => [$outWidth, $outHeight]) {
                $crop = $settings[$platform];
                [$outWidth, $outHeight] = self::outputSize($platform, $crop);
                $rectangle = self::cropRectangle($width, $height, $platform, $crop);
                $canvas = imagecreatetruecolor($outWidth, $outHeight);
                if ($platform === 'website') {
                    imagealphablending($canvas, false);
                    imagesavealpha($canvas, true);
                    imagefill($canvas, 0, 0, imagecolorallocatealpha($canvas, 0, 0, 0, 127));
                } else {
                    imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
                }
                imagecopyresampled($canvas, $source, 0, 0, $rectangle['x'], $rectangle['y'], $outWidth, $outHeight, $rectangle['width'], $rectangle['height']);
                try {
                    if ($platform === 'website') {
                        $encoded = NewsImageOptimizer::encodeWebp($canvas);
                    } else {
                        ob_start();
                        imagejpeg($canvas, null, 95);
                        $encoded = ob_get_clean();
                    }
                } finally {
                    imagedestroy($canvas);
                }
                $extension = $platform === 'website' ? 'webp' : 'jpg';
                $destination = $directory.'/'.hash('sha256', $bytes.json_encode($crop).$platform.'v2').'.'.$extension;
                if (! $disk->exists($destination) && ! $disk->put($destination, $encoded, ['visibility' => 'public', 'ContentType' => $platform === 'website' ? 'image/webp' : 'image/jpeg'])) {
                    throw ValidationException::withMessages(['image_crops' => 'Potongan gambar gagal disimpan. Silakan coba lagi.']);
                }
                $variants[$platform] = config('filesystems.news_media_disk', 'public') === 'public'
                    ? rtrim(config('app.url'), '/').'/storage/'.$destination : $disk->url($destination);
            }

            return $variants;
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable) {
            throw ValidationException::withMessages(['image_crops' => 'Potongan gambar gagal diproses. Periksa dukungan GD WebP dan penyimpanan.']);
        } finally {
            imagedestroy($source);
        }
    }
}
