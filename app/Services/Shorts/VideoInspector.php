<?php

namespace App\Services\Shorts;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

class VideoInspector
{
    public function inspect(UploadedFile $file): array
    {
        $process = new Process([config('shorts.ffprobe'), '-v', 'error', '-protocol_whitelist', 'file', '-show_format', '-show_streams', '-of', 'json', $file->getRealPath()]);
        $process->setTimeout(30);
        try {
            $process->mustRun();
            $data = json_decode($process->getOutput(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            throw ValidationException::withMessages(['video' => 'Video tidak dapat diperiksa. Pastikan ffprobe tersedia di server dan berkas video valid.']);
        }
        $v = collect($data['streams'] ?? [])->firstWhere('codec_type', 'video');
        $a = collect($data['streams'] ?? [])->firstWhere('codec_type', 'audio');
        [$num, $den] = array_pad(explode('/', $v['avg_frame_rate'] ?? '0/1'), 2, 1);
        $m = ['format' => $data['format']['format_name'] ?? '', 'codec' => $v['codec_name'] ?? '', 'pixel_format' => $v['pix_fmt'] ?? '',
            'width' => (int) ($v['width'] ?? 0), 'height' => (int) ($v['height'] ?? 0),
            'duration' => (float) ($data['format']['duration'] ?? 0), 'fps' => (float) $num / max(1, (float) $den),
            'bitrate' => (int) ($v['bit_rate'] ?? $data['format']['bit_rate'] ?? 0), 'bytes' => $file->getSize(),
            'audio_codec' => $a['codec_name'] ?? null, 'audio_rate' => (int) ($a['sample_rate'] ?? 0), 'audio_channels' => (int) ($a['channels'] ?? 0),
            'field_order' => $v['field_order'] ?? 'unknown',
            'rotation' => (int) ($v['tags']['rotate'] ?? collect($v['side_data_list'] ?? [])->firstWhere('side_data_type', 'Display Matrix')['rotation'] ?? 0)];
        $this->validate($m, ['website']);

        return $m;
    }

    public function validate(array $m, array $platforms): void
    {
        // Deliberately conservative MP4/H.264 profile for browser playback; never silently transcode.
        $errors = [];
        if (! str_contains($m['format'] ?? '', 'mp4') || ($m['codec'] ?? '') !== 'h264' || ($m['pixel_format'] ?? '') !== 'yuv420p') {
            $errors[] = 'Gunakan MP4 H.264, warna yuv420p.';
        }
        if (($m['width'] ?? 0) < 1 || ($m['height'] ?? 0) < 1 || ($m['duration'] ?? 0) <= 0 || ($m['duration'] ?? 0) > 900 || ($m['bytes'] ?? 0) > config('shorts.max_upload_kb') * 1024) {
            $errors[] = 'Video harus berdurasi maksimal 15 menit dan berukuran maksimal 100 MB.';
        }
        if (($m['audio_codec'] ?? null) && (($m['audio_codec'] !== 'aac') || $m['audio_rate'] > 48000 || $m['audio_channels'] > 2)) {
            $errors[] = 'Audio harus AAC, maksimal 48 kHz dan stereo.';
        }
        if (($m['rotation'] ?? 0) % 360 !== 0) {
            $errors[] = 'Ekspor video dengan orientasi final tanpa metadata rotasi.';
        }
        if (array_intersect($platforms, ['instagram', 'facebook'])) {
            if ($m['fps'] < 23 || $m['fps'] > 60 || $m['width'] > 1920 || $m['duration'] < 3 || ($m['bitrate'] ?? 0) > 25000000 || ! in_array($m['field_order'] ?? 'unknown', ['progressive', 'unknown'])) {
                $errors[] = 'Reels memerlukan 23-60 FPS, lebar maksimal 1920 px, durasi minimal 3 detik, progressive, bitrate maksimal 25 Mbps.';
            }
        }
        if (in_array('facebook', $platforms) && ($m['duration'] < 4 || $m['duration'] > 60 || $m['width'] < 540 || $m['height'] < 960 || abs($m['width'] / max(1, $m['height']) - 9 / 16) > .005)) {
            $errors[] = 'Profil Facebook Reels yang didukung: 9:16, minimal 540x960, durasi 4-60 detik.';
        }
        if ($errors) {
            throw ValidationException::withMessages(['video' => implode(' ', $errors)]);
        }
    }
}
