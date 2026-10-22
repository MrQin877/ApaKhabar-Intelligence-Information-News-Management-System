<?php

namespace App\Services\Shorts;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

class LocalShortMedia
{
    private function validPath(?string $path): bool
    {
        return (bool) preg_match('#^shorts/(?:original|edits|covers)/[A-Za-z0-9_-]+\.(?:mp4|jpe?g|png)$#', $path ?? '');
    }

    public function store(UploadedFile $file, string $kind = 'original'): array
    {
        abort_unless(in_array($kind, ['original', 'edits'], true), 422);
        $path = 'shorts/'.$kind.'/'.Str::uuid().'.mp4';
        if (! Storage::disk('public')->putFileAs(dirname($path), $file, basename($path))) {
            throw ValidationException::withMessages(['video' => 'Video tidak dapat disimpan.']);
        }

        return ['path' => $path, 'url' => Storage::disk('public')->url($path)];
    }

    public function file(string $path): UploadedFile
    {
        abort_unless($this->validPath($path) && str_ends_with($path, '.mp4') && Storage::disk('public')->exists($path), 422, 'Berkas video lokal tidak tersedia.');

        return new UploadedFile(Storage::disk('public')->path($path), 'short.mp4', 'video/mp4', null, true);
    }

    public function frame(string $path, float $offset): string
    {
        $file = $this->file($path);
        $target = 'shorts/covers/'.Str::uuid().'.jpg';
        $absolute = Storage::disk('public')->path($target);
        if (! is_dir(dirname($absolute))) {
            mkdir(dirname($absolute), 0775, true);
        }
        $binary = config('shorts.ffmpeg') ?: preg_replace('/ffprobe(\.exe)?$/i', 'ffmpeg$1', config('shorts.ffprobe'));
        $process = new Process([$binary, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', (string) $offset, '-i', $file->getRealPath(), '-frames:v', '1', '-q:v', '3', $absolute]);
        try {
            $process->mustRun();
            if (! is_file($absolute) || filesize($absolute) === 0) {
                throw new \RuntimeException('Empty frame');
            }

            return Storage::disk('public')->url($target);
        } catch (\Throwable) {
            Storage::disk('public')->delete($target);
            throw ValidationException::withMessages(['cover' => 'Bingkai video tidak dapat disimpan.']);
        }
    }

    public function cover(UploadedFile $file): string
    {
        $path = 'shorts/covers/'.Str::uuid().'.'.$file->extension();
        if (! Storage::disk('public')->putFileAs(dirname($path), $file, basename($path))) {
            throw ValidationException::withMessages(['cover' => 'Sampul tidak dapat disimpan.']);
        }

        return Storage::disk('public')->url($path);
    }

    public function delete(?string $path): void
    {
        if ($this->validPath($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    public function pathFromUrl(?string $url): ?string
    {
        $path = parse_url($url ?? '', PHP_URL_PATH) ?: '';
        $prefix = '/storage/shorts/';
        $at = strpos($path, $prefix);

        $candidate = $at === false ? null : 'shorts/'.substr($path, $at + strlen($prefix));

        return $this->validPath($candidate) ? $candidate : null;
    }
}
