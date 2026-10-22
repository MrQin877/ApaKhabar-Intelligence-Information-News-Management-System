<?php

namespace App\Services\Shorts;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

class VideoCropper
{
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
            $metadata = $inspector->inspect(new UploadedFile($input, 'source.mp4', 'video/mp4', null, true));
            if ($edit['end'] > $metadata['duration'] + 0.05 || $edit['start'] >= $edit['end']) {
                throw ValidationException::withMessages(['video' => 'Rentang waktu video tidak valid.']);
            }
            $sar = $metadata['sample_aspect_ratio'] ?? 1;
            $width = (int) round($metadata['width'] * $sar / 2) * 2;
            if ($width < 18 || $width > 8192 || $metadata['height'] < 32 || $metadata['height'] > 8192) {
                throw ValidationException::withMessages(['video' => 'Dimensi sumber tidak didukung untuk crop (maksimal 8192 px).']);
            }
            $rect = self::rectangle($width, $metadata['height'], $edit);
            $filters = "scale={$width}:{$metadata['height']},setsar=1,crop={$rect['width']}:{$rect['height']}:{$rect['x']}:{$rect['y']},scale=1080:1920,setsar=1";
            $binary = config('shorts.ffmpeg');
            if (! $binary) {
                $probe = config('shorts.ffprobe');
                $binary = preg_replace('/ffprobe(\.exe)?$/i', 'ffmpeg$1', $probe);
            }
            $process = new Process([$binary, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
                '-protocol_whitelist', 'file', '-i', $input, '-ss', (string) $edit['start'],
                '-t', (string) ($edit['end'] - $edit['start']), '-map', '0:v:0', '-map', '0:a:0?',
                '-vf', $filters, '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-maxrate', '8M', '-bufsize', '16M',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
                '-map_metadata', '-1', '-metadata:s:v:0', 'rotate=0', '-movflags', '+faststart', '-f', 'mp4', $output]);
            $process->setTimeout(config('shorts.crop_timeout', 300));
            $process->mustRun();
            $file = new UploadedFile($output, 'cropped.mp4', 'video/mp4', null, true);
            $result = $inspector->inspect($file);
            if ($result['width'] !== 1080 || $result['height'] !== 1920 || ($result['rotation'] ?? 0) % 360 !== 0 || abs(($result['sample_aspect_ratio'] ?? 1) - 1) > 0.0001) {
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
