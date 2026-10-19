<?php

namespace App\Services;

use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class NewsImageOptimizer
{
    public const QUALITY = 80;
    public const MAX_WIDTH = 1920;
    public const MAX_PIXELS = 24000000;

    public function store(UploadedFile $file, string $directory = 'news-images', string $field = 'image'): string
    {
        try {
            if (! $file->isValid() || $file->getSize() > 10 * 1024 * 1024) {
                throw new RuntimeException('Invalid upload.');
            }
            $bytes = file_get_contents($file->getRealPath());
            if ($bytes === false) {
                throw new RuntimeException('Unreadable upload.');
            }
            $webp = $this->convert($bytes);
            // Content addressing prevents repeated uploads from creating duplicate originals.
            $path = trim($directory, '/').'/'.hash('sha256', $webp).'.webp';
            $disk = Storage::disk(config('filesystems.news_media_disk', 'public'));
            if (! $disk->exists($path) && ! $disk->put($path, $webp, ['visibility' => 'public', 'ContentType' => 'image/webp'])) {
                throw new RuntimeException('Storage write failed.');
            }

            return $path;
        } catch (\Throwable) {
            throw ValidationException::withMessages([$field => 'Gambar gagal diproses atau disimpan. Gunakan JPG, PNG, atau WebP yang valid (maksimal 24 megapiksel) dan pastikan GD WebP serta EXIF tersedia.']);
        }
    }

    public function convert(string $bytes): string
    {
        if (! function_exists('imagewebp') || ! (gd_info()['WebP Support'] ?? false)) {
            throw new RuntimeException('GD WebP support is required.');
        }
        $info = @getimagesizefromstring($bytes);
        if (! $info || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)
            || $info[0] * $info[1] > self::MAX_PIXELS) {
            throw new RuntimeException('Unsupported image or excessive dimensions.');
        }
        // GD allocations can exceed PHP's accounted memory; reserve room before decoding.
        $limit = ini_parse_quantity(ini_get('memory_limit'));
        if ($limit > 0 && memory_get_usage(true) + strlen($bytes) + $info[0] * $info[1] * 20 + 16 * 1024 * 1024 > $limit) {
            throw new RuntimeException('Insufficient memory for image processing.');
        }
        $source = @imagecreatefromstring($bytes);
        if (! $source) {
            throw new RuntimeException('Invalid image data.');
        }
        $canvas = null;
        try {
            if ($info[2] === IMAGETYPE_JPEG) {
                $source = self::orientJpeg($source, $bytes);
            }
            $width = min(self::MAX_WIDTH, imagesx($source));
            $height = max(1, (int) round(imagesy($source) * $width / imagesx($source)));
            if ($height > 16383) {
                throw new RuntimeException('Image exceeds WebP height limit.');
            }
            $canvas = imagecreatetruecolor($width, $height);
            imagealphablending($canvas, false);
            imagesavealpha($canvas, true);
            imagefill($canvas, 0, 0, imagecolorallocatealpha($canvas, 0, 0, 0, 127));
            if (! imagecopyresampled($canvas, $source, 0, 0, 0, 0, $width, $height, imagesx($source), imagesy($source))) {
                throw new RuntimeException('Resize failed.');
            }

            return self::encodeWebp($canvas);
        } finally {
            imagedestroy($source);
            if ($canvas instanceof GdImage) {
                imagedestroy($canvas);
            }
        }
    }

    public static function encodeWebp(GdImage $image): string
    {
        $level = ob_get_level();
        try {
            ob_start();
            $ok = imagewebp($image, null, self::QUALITY);
            $bytes = ob_get_clean();
            // GD can return true without producing output; inspect the encoded bytes too.
            if (! $ok || ! is_string($bytes) || (@getimagesizefromstring($bytes)[2] ?? null) !== IMAGETYPE_WEBP) {
                throw new RuntimeException('WebP encoding failed.');
            }

            return $bytes;
        } finally {
            while (ob_get_level() > $level) {
                ob_end_clean();
            }
        }
    }

    public static function orientJpeg(GdImage $image, string $bytes): GdImage
    {
        if (! function_exists('exif_read_data')) {
            throw new RuntimeException('EXIF support is required to preserve JPEG orientation.');
        }
        $stream = tmpfile();
        if (! $stream) {
            throw new RuntimeException('Unable to read EXIF.');
        }
        try {
            fwrite($stream, $bytes);
            rewind($stream);
            $orientation = (int) (@exif_read_data($stream)['Orientation'] ?? 1);
        } finally {
            fclose($stream);
        }
        if (in_array($orientation, [2, 5, 7], true)) {
            imageflip($image, IMG_FLIP_HORIZONTAL);
        }
        if ($orientation === 4) {
            imageflip($image, IMG_FLIP_VERTICAL);
        }
        $angle = match ($orientation) { 3 => 180, 5, 8 => 90, 6, 7 => -90, default => 0 };
        if ($angle) {
            $rotated = imagerotate($image, $angle, 0);
            if (! $rotated) {
                throw new RuntimeException('Orientation correction failed.');
            }
            imagedestroy($image);

            return $rotated;
        }

        return $image;
    }
}
