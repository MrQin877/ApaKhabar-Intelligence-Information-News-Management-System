<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class NewsImageCropService
{
    public const SIZES = ['website' => [1600, 900], 'instagram' => [1080, 1080], 'facebook' => [1200, 630]];

    public function generate(string $url, array $settings): array
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
            // Browsers apply JPEG orientation before displaying the crop preview.
            if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
                $stream = tmpfile();
                if ($stream) {
                    fwrite($stream, $bytes);
                    rewind($stream);
                    $orientation = (@exif_read_data($stream)['Orientation'] ?? 1);
                    fclose($stream);
                    if (in_array($orientation, [2, 5, 7], true)) {
                        imageflip($source, IMG_FLIP_HORIZONTAL);
                    }
                    if ($orientation === 4) {
                        imageflip($source, IMG_FLIP_VERTICAL);
                    }
                    $angle = match ($orientation) {
                        3 => 180, 5, 8 => 90, 6, 7 => -90, default => 0
                    };
                    if ($angle) {
                        $rotated = imagerotate($source, $angle, 0);
                        imagedestroy($source);
                        $source = $rotated;
                    }
                }
            }
            $width = imagesx($source);
            $height = imagesy($source);
            $variants = [];
            foreach (self::SIZES as $platform => [$outWidth, $outHeight]) {
                $crop = $settings[$platform];
                $ratio = $outWidth / $outHeight;
                $cropWidth = max(1, (int) round(min($width, $height * $ratio) / $crop['zoom']));
                $cropHeight = max(1, (int) round(min($height, $width / $ratio) / $crop['zoom']));
                $left = (int) round(max(0, min($width - $cropWidth, $crop['x'] * $width - $cropWidth / 2)));
                $top = (int) round(max(0, min($height - $cropHeight, $crop['y'] * $height - $cropHeight / 2)));
                $canvas = imagecreatetruecolor($outWidth, $outHeight);
                imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
                imagecopyresampled($canvas, $source, 0, 0, $left, $top, $outWidth, $outHeight, $cropWidth, $cropHeight);
                ob_start();
                imagejpeg($canvas, null, 95);
                $jpeg = ob_get_clean();
                imagedestroy($canvas);
                $destination = 'news-images/crops/'.hash('sha256', $bytes.json_encode($crop).$platform.'v1').'.jpg';
                if (! $disk->put($destination, $jpeg, 'public')) {
                    throw ValidationException::withMessages(['image_crops' => 'Potongan gambar gagal disimpan. Silakan coba lagi.']);
                }
                $variants[$platform] = config('filesystems.news_media_disk', 'public') === 'public'
                    ? rtrim(config('app.url'), '/').'/storage/'.$destination : $disk->url($destination);
            }

            return $variants;
        } finally {
            imagedestroy($source);
        }
    }
}
