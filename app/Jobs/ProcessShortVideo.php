<?php

namespace App\Jobs;

use App\Models\ShortVideo;
use App\Services\Shorts\LocalShortMedia;
use App\Services\Shorts\VideoCropper;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class ProcessShortVideo implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 420;

    public bool $failOnTimeout = true;

    public function __construct(public int $videoId, public string $revision)
    {
        // The existing local default worker has access to storage and FFmpeg.
        // Never execute an export inside an HTTP request, even with QUEUE_CONNECTION=sync.
        $this->onConnection(config('queue.default') === 'sync' ? 'database' : config('queue.default'));
        $this->onQueue('default');
    }

    public static function pending(?array $edit = null): array
    {
        return ['revision' => (string) Str::uuid(), 'status' => 'queued', 'edit' => $edit, 'error' => null];
    }

    public static function enqueue(ShortVideo $video): void
    {
        $job = new self($video->id, $video->metadata['processing']['revision']);
        DB::afterCommit(function () use ($job) {
            try {
                dispatch($job);
            } catch (Throwable $e) {
                $job->failed($e);
            }
        });
    }

    public function handle(VideoCropper $cropper, LocalShortMedia $local): void
    {
        $video = DB::transaction(function () {
            $v = ShortVideo::whereKey($this->videoId)->lockForUpdate()->first();
            if (! $v || $v->status !== 'draft' || ($v->metadata['processing']['revision'] ?? null) !== $this->revision || ($v->metadata['processing']['status'] ?? null) !== 'queued') {
                return null;
            }
            $m = $v->metadata;
            $m['processing']['status'] = 'processing';
            $m['processing']['started_at'] = now()->toIso8601String();
            $v->update(['metadata' => $m]);

            return $v;
        });
        if (! $video) {
            return;
        }
        $result = null;
        $frame = null;
        $accepted = false;
        $obsolete = [];
        try {
            $edit = $video->metadata['processing']['edit'];
            if ($edit) {
                $source = $video->metadata['crop_source'];
                $result = isset($source['path']) ? $cropper->export($source['url'], $edit, $source['path']) : $cropper->export($source['url'], $edit);
            }
            // Re-read under a row lock: text/cover saves may have happened during export.
            DB::transaction(function () use ($local, $result, &$frame, &$accepted, &$obsolete) {
                $v = ShortVideo::whereKey($this->videoId)->lockForUpdate()->first();
                if (! $v || $v->status !== 'draft' || ($v->metadata['processing']['revision'] ?? null) !== $this->revision || ($v->metadata['processing']['status'] ?? null) !== 'processing') {
                    return;
                }
                $m = $v->metadata;
                $attributes = [];
                if ($result) {
                    if (($m['local_path'] ?? null) !== ($m['crop_source']['path'] ?? null)) {
                        $obsolete[] = $m['local_path'] ?? null;
                    }
                    $m = [...$m, ...$result['metadata'], 'local_path' => $result['asset']['path']];
                    unset($m['social_asset'], $m['social_cover']);
                    $attributes = ['video_url' => $result['asset']['url'], 'video_public_id' => ''];
                }
                if (($m['cover_source'] ?? 'frame') === 'frame' && ! empty($m['local_path'])) {
                    if ($v->thumbnail_url !== ($m['cover_original'] ?? null)) {
                        $obsolete[] = $local->pathFromUrl($v->thumbnail_url);
                    }
                    $attributes['frame_offset'] = min($v->frame_offset, max(0, $m['duration'] - 0.05));
                    $frame = $local->frame($m['local_path'], min($v->frame_offset, max(0, $m['duration'] - 0.05)));
                    $attributes['thumbnail_url'] = $frame;
                    $attributes['thumbnail_public_id'] = null;
                }
                $m['processing']['status'] = 'ready';
                $m['processing']['error'] = null;
                $v->update([...$attributes, 'metadata' => $m]);
                $accepted = true;
            });
            if ($accepted) {
                foreach ($obsolete as $path) {
                    $local->delete($path);
                }
            }
        } catch (Throwable $e) {
            $this->failed($e);
            throw $e;
        } finally {
            if (! $accepted) {
                $local->delete($result['asset']['path'] ?? null);
                $local->delete($local->pathFromUrl($frame));
            }
        }
    }

    public function failed(?Throwable $exception): void
    {
        DB::transaction(function () {
            $v = ShortVideo::whereKey($this->videoId)->lockForUpdate()->first();
            if (! $v || $v->status !== 'draft' || ($v->metadata['processing']['revision'] ?? null) !== $this->revision || ($v->metadata['processing']['status'] ?? null) === 'ready') {
                return;
            }
            $m = $v->metadata;
            $m['processing']['status'] = 'failed';
            $m['processing']['error'] = 'Video gagal diproses. Video asli dan pengaturan tetap tersimpan. Silakan coba lagi.';
            $v->update(['metadata' => $m]);
        });
    }
}
