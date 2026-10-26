<?php

namespace App\Services\Shorts;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

class VideoCropper
{
    public static function displaySize(array $metadata): array
    {
        $width = (int) round($metadata['width'] * ($metadata['sample_aspect_ratio'] ?? 1) / 2) * 2;
        $height = $metadata['height'];

        return abs($metadata['rotation'] ?? 0) % 180 === 90 ? [$height, $width] : [$width, $height];
    }

    public static function needsFit(array $metadata): bool
    {
        return ($metadata['rotation'] ?? 0) % 360 !== 0
            || ($metadata['display_transform'] ?? false)
            || abs(($metadata['sample_aspect_ratio'] ?? 1) - 1) > 0.0001
            || $metadata['width'] * 16 !== $metadata['height'] * 9;
    }

    public static function rectangle(int $width, int $height, array $edit): array
    {
        // Multiples of 18/32 give an exact 9:16 crop with even H.264 dimensions.
        $unit = (int) floor(min($width / 18, $height / 32) / $edit['zoom']);
        if ($unit < 1) {
            throw ValidationException::withMessages(['video' => 'Area potong terlalu kecil.']);
        }
        $w = $unit * 18;
        $h = $unit * 32;

        return ['width' => $w, 'height' => $h,
            'x' => (int) floor(($width - $w) * $edit['x'] / 2) * 2,
            'y' => (int) floor(($height - $h) * $edit['y'] / 2) * 2];
    }

    public function export(string $url, array $edit, ?string $localPath = null): array
    {
        $cloud = app(CloudinaryVideoService::class);
        $input = tempnam(sys_get_temp_dir(), 'short-in-');
        $output = tempnam(sys_get_temp_dir(), 'short-out-');
        try {
            if ($localPath) {
                copy(app(LocalShortMedia::class)->file($localPath)->getRealPath(), $input);
            } else {
                $cloud->assertUrl($url);
                $limit = config('shorts.max_upload_kb') * 1024;
                $response = Http::withoutRedirecting()->connectTimeout(10)->timeout(120)
                    ->withOptions(['sink' => $input, 'progress' => function ($total, $downloaded) use ($limit) {
                        if ($total > $limit || $downloaded > $limit) {
                            throw new \RuntimeException('Video terlalu besar.');
                        }
                    }])->get($url);
                if (! $response->successful() || filesize($input) > $limit) {
                    throw new \RuntimeException('Video tidak dapat diunduh.');
                }
            }
            $inspector = app(VideoInspector::class);
            $metadata = $inspector->inspect(new UploadedFile($input, 'source.mp4', 'video/mp4', null, true), true);
            if ($edit['end'] > $metadata['duration'] + 0.05 || $edit['start'] >= $edit['end']) {
                throw ValidationException::withMessages(['video' => 'Rentang waktu video tidak valid.']);
            }
            [$width, $height] = self::displaySize($metadata);
            if ($width < 18 || $width > 8192 || $height < 32 || $height > 8192) {
                throw ValidationException::withMessages(['video' => 'Dimensi sumber tidak didukung untuk crop (maksimal 8192 px).']);
            }
            $rect = self::rectangle($width, $height, $edit);
            // Avoid upscaling every edit to 1080p. Keep a Reels-compatible minimum.
            $sourceWidth = ($edit['mode'] ?? 'crop') === 'fit' ? min($width, $height) : $rect['width'];
            $outputWidth = min(1080, max(540, (int) floor($sourceWidth / 18) * 18));
            $outputHeight = (int) ($outputWidth * 16 / 9);
            $size = "{$outputWidth}:{$outputHeight}";
            // FFmpeg autorotates exactly once, before this graph. Geometry uses display dimensions.
            $filters = "[0:v:0]scale={$width}:{$height},setsar=1,";
            $filters .= ($edit['mode'] ?? 'crop') === 'fit'
                ? "split=2[bg][fg];[bg]scale={$size}:force_original_aspect_ratio=increase,crop={$size},gblur=sigma=30[blur];[fg]scale={$size}:force_original_aspect_ratio=decrease:force_divisible_by=2[front];[blur][front]overlay=(W-w)/2:(H-h)/2,setsar=1[out]"
                : "crop={$rect['width']}:{$rect['height']}:{$rect['x']}:{$rect['y']},scale={$size},setsar=1[out]";
            $binary = config('shorts.ffmpeg');
            if (! $binary) {
                $probe = config('shorts.ffprobe');
                $binary = preg_replace('/ffprobe(\.exe)?$/i', 'ffmpeg$1', $probe);
            }
            $process = new Process([$binary, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
                '-protocol_whitelist', 'file', '-i', $input, '-ss', (string) $edit['start'],
                '-t', (string) ($edit['end'] - $edit['start']), '-map', '[out]', '-map', '0:a:0?',
                '-filter_complex', $filters, '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-maxrate', '8M', '-bufsize', '16M',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
                '-map_metadata', '-1', '-metadata:s:v:0', 'rotate=0', '-movflags', '+faststart', '-f', 'mp4', $output]);
            $process->setTimeout(config('shorts.crop_timeout', 300));
            $started = hrtime(true);
            $process->mustRun();
            Log::info('Short FFmpeg export timing', ['duration_ms' => (int) ((hrtime(true) - $started) / 1_000_000)]);
            $file = new UploadedFile($output, 'cropped.mp4', 'video/mp4', null, true);
            $result = $inspector->inspect($file);
            if ($result['width'] !== $outputWidth || $result['height'] !== $outputHeight || ($result['rotation'] ?? 0) % 360 !== 0 || abs(($result['sample_aspect_ratio'] ?? 1) - 1) > 0.0001) {
                throw new \RuntimeException('Orientasi hasil ekspor tidak valid.');
            }

            return ['asset' => app(LocalShortMedia::class)->store($file, 'edits'), 'metadata' => $result];
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            report($e);
            throw ValidationException::withMessages(['video' => 'Ekspor video gagal. Pastikan FFmpeg tersedia dan coba lagi. Video sebelumnya tetap tersimpan.']);
        } finally {
            foreach ([$input, $output] as $path) {
                if ($path && is_file($path)) {
                    unlink($path);
                }
            }
        }
    }
}
