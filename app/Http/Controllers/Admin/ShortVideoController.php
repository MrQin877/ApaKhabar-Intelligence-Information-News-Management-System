<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\PublishShortVideo;
use App\Models\ShortVideo;
use App\Models\SocialConnection;
use App\Services\News\MetaConnections;
use App\Services\Shorts\CloudinaryVideoService;
use App\Services\Shorts\LocalShortMedia;
use App\Services\Shorts\ReelCaption;
use App\Services\Shorts\VideoCropper;
use App\Services\Shorts\VideoInspector;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ShortVideoController extends Controller
{
    public function index(Request $r, MetaConnections $meta)
    {
        $filters = $r->validate(['search' => 'nullable|string|max:255', 'status' => ['nullable', Rule::in(['all', 'published', 'draft', 'archived'])]]);
        $query = ShortVideo::where('created_by', $r->user()->getKey())->with('publications');
        if ($search = trim($filters['search'] ?? '')) {
            $query->where('title', 'like', '%'.addcslashes($search, '%_\\').'%');
        }
        if (($filters['status'] ?? 'all') !== 'all') {
            $query->where('status', $filters['status']);
        }

        return Inertia::render('admin/short-videos', ['mode' => 'list', 'filters' => ['search' => $search, 'status' => $filters['status'] ?? 'all'], 'videos' => $query->latest()->paginate(12)->withQueryString(), 'publishPlatforms' => $meta->platforms($r->user()->getKey()), 'metaAuth' => $meta->publicConfig()]);
    }

    public function create(Request $r, MetaConnections $meta)
    {
        $draft = null;
        if ($r->filled('draft')) {
            $r->validate(['draft' => 'integer']);
            $draft = ShortVideo::findOrFail($r->integer('draft'));
            $this->own($r, $draft);
            abort_unless($draft->status === 'draft', 422, 'Hanya draf dapat diedit.');
        }

        return Inertia::render('admin/short-videos', ['mode' => 'editor', 'draft' => $draft, 'videos' => ['data' => [], 'current_page' => 1, 'last_page' => 1], 'publishPlatforms' => $meta->platforms($r->user()->getKey()), 'metaAuth' => $meta->publicConfig()]);
    }

    private function own(Request $r, ShortVideo $video): void
    {
        abort_unless($video->created_by === $r->user()->getKey(), 403);
    }

    public function upload(Request $r, VideoInspector $inspector, LocalShortMedia $local)
    {
        $r->validate(['frame_offset' => 'sometimes|numeric|min:0', 'edit' => 'sometimes|array:mode,x,y,zoom,start,end|min:6', 'edit.mode' => ['required_with:edit', Rule::in(['fit', 'crop'])], 'edit.x' => 'required_with:edit|numeric|between:0,1', 'edit.y' => 'required_with:edit|numeric|between:0,1', 'edit.zoom' => 'required_with:edit|numeric|between:1,4', 'edit.start' => 'required_with:edit|numeric|min:0', 'edit.end' => 'required_with:edit|numeric|gt:edit.start', 'video' => ['required', 'file', 'mimetypes:video/mp4', 'extensions:mp4', 'max:'.config('shorts.max_upload_kb')], 'short_video_id' => 'nullable|integer|exists:short_videos,id']);
        $existing = $r->filled('short_video_id') ? ShortVideo::findOrFail($r->integer('short_video_id')) : null;
        if ($existing) {
            $this->own($r, $existing);
            abort_unless($existing->status === 'draft', 422, 'Hanya draf dapat diedit.');
        }
        $lock = $existing ? Cache::lock('short-crop:'.$existing->id, 900) : null;
        if ($lock) {
            abort_unless($lock->get(), 409, 'Video sedang diproses. Tunggu sampai selesai.');
        }
        try {
            $metadata = $inspector->inspect($r->file('video'), true);
            $oldMetadata = $existing?->metadata;
            $oldCover = $existing?->thumbnail_url;
            $asset = $local->store($r->file('video'));
            $original = $asset;
            try {
                if (VideoCropper::needsFit($metadata) || $r->has('edit')) {
                    @set_time_limit(660);
                    $edit = $r->input('edit', ['mode' => 'fit', 'x' => 0.5, 'y' => 0.5, 'zoom' => 1, 'start' => 0, 'end' => $metadata['duration']]);
                    $edit = ['mode' => $edit['mode'], ...array_map('floatval', Arr::only($edit, ['x', 'y', 'zoom', 'start', 'end']))];
                    $result = app(VideoCropper::class)->export($asset['url'], $edit, $asset['path']);
                    $source = [...$asset, 'public_id' => '', 'metadata' => $metadata];
                    $asset = $result['asset'];
                    $metadata = [...$result['metadata'], 'crop_source' => $source, 'video_crop' => $edit];
                }
                $frameOffset = $r->has('edit') ? max(0, min((float) $r->input('frame_offset', 0) - (float) $edit['start'], max(0, $metadata['duration'] - 0.05))) : 0;
                $frame = $local->frame($asset['path'], $frameOffset);
                $attributes = ['video_url' => $asset['url'], 'video_public_id' => '', 'thumbnail_url' => $frame, 'thumbnail_public_id' => null, 'frame_offset' => $frameOffset,
                    'metadata' => [...$metadata, 'local_path' => $asset['path'], 'cover_source' => 'frame']];
                if ($existing) {
                    DB::transaction(function () use ($existing, $attributes, $r) {
                        $video = ShortVideo::whereKey($existing->id)->lockForUpdate()->firstOrFail();
                        $this->own($r, $video);
                        abort_unless($video->status === 'draft', 422, 'Hanya draf dapat diedit.');
                        $video->update($attributes);
                    });
                    $video = $existing;
                } else {
                    $video = ShortVideo::create(['created_by' => $r->user()->getKey(), ...$attributes]);
                }
            } catch (\Throwable $e) {
                $local->delete($asset['path']);
                $local->delete($original['path']);
                $local->delete($local->pathFromUrl($frame ?? null));
                throw $e;
            }
            if ($existing) {
                $local->delete($oldMetadata['local_path'] ?? null);
                $local->delete($oldMetadata['crop_source']['path'] ?? null);
                $local->delete($local->pathFromUrl($oldMetadata['cover_original'] ?? null));
                $local->delete($local->pathFromUrl($oldCover));
            }

            return response()->json(['video' => $video->refresh()], $existing ? 200 : 201);
        } finally {
            $lock?->release();
        }
    }

    public function crop(Request $r, ShortVideo $shortVideo, VideoCropper $cropper, LocalShortMedia $local)
    {
        $this->own($r, $shortVideo);
        abort_unless($shortVideo->status === 'draft', 422, 'Hanya draf dapat diedit.');
        $data = $r->validate([
            'expected_url' => 'required|string|max:2048',
            'x' => 'required|numeric|between:0,1', 'y' => 'required|numeric|between:0,1',
            'zoom' => 'required|numeric|between:1,4',
            'mode' => ['sometimes', Rule::in(['fit', 'crop'])],
            'start' => 'required|numeric|min:0', 'end' => 'required|numeric|gt:start',
            'frame_offset' => 'sometimes|numeric|min:0',
        ]);
        $lock = Cache::lock('short-crop:'.$shortVideo->id, 900);
        abort_unless($lock->get(), 409, 'Video sedang diproses. Tunggu sampai selesai.');
        try {
            $shortVideo->refresh();
            abort_unless($shortVideo->status === 'draft' && $shortVideo->video_url === $data['expected_url'], 409, 'Video telah berubah. Muat ulang editor.');
            $source = $shortVideo->metadata['crop_source'] ?? [
                'url' => $shortVideo->video_url, 'path' => $shortVideo->metadata['local_path'] ?? null,
                'public_id' => $shortVideo->video_public_id, 'metadata' => $shortVideo->metadata,
            ];
            $edit = array_map('floatval', Arr::only($data, ['x', 'y', 'zoom', 'start', 'end']));
            $edit['mode'] = $data['mode'] ?? 'crop';
            $m = $source['metadata'];
            abort_if($edit['end'] > $m['duration'] + 0.05 || $edit['end'] - $edit['start'] < 0.1, 422, 'Rentang waktu video tidak valid.');
            $previous = $shortVideo->metadata['video_crop'] ?? null;
            $selectedOffset = (float) ($data['frame_offset'] ?? $shortVideo->frame_offset);
            abort_if($selectedOffset >= $shortVideo->metadata['duration'], 422, 'Bingkai video tidak valid.');
            $nextOffset = max(0, min($selectedOffset + ($previous['start'] ?? 0) - $edit['start'], max(0, $edit['end'] - $edit['start'] - 0.05)));
            [$width, $height] = VideoCropper::displaySize($m);
            $rect = VideoCropper::rectangle($width, $height, $edit);
            $same = $previous && $edit['mode'] === ($previous['mode'] ?? 'crop')
                && ($edit['mode'] === 'fit' || $rect === VideoCropper::rectangle($width, $height, $previous))
                && abs($edit['start'] - $previous['start']) < 0.001 && abs($edit['end'] - $previous['end']) < 0.001;
            $unchanged = ! $previous && ! VideoCropper::needsFit($m) && ($edit['mode'] === 'fit' || ($rect['width'] === $width && $rect['height'] === $height))
                && $edit['start'] === 0.0 && abs($edit['end'] - $m['duration']) < 0.001;
            if ($same || $unchanged) {
                return response()->json(['video' => $shortVideo, 'changed' => false]);
            }
            @set_time_limit(660);
            $result = isset($source['path']) ? $cropper->export($source['url'], $edit, $source['path']) : $cropper->export($source['url'], $edit);
            try {
                $frame = ($shortVideo->metadata['cover_source'] ?? (str_contains($shortVideo->thumbnail_url, '/video/upload/') ? 'frame' : 'photo')) === 'frame'
                    ? $local->frame($result['asset']['path'], $nextOffset) : null;
                DB::transaction(function () use ($shortVideo, $data, $result, $source, $edit, $frame, $nextOffset) {
                    $video = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
                    abort_unless($video->status === 'draft' && $video->video_url === $data['expected_url'], 409, 'Video telah berubah. Muat ulang editor.');
                    $attributes = ['video_url' => $result['asset']['url'], 'video_public_id' => '',
                        'metadata' => [...Arr::only($video->metadata, ['cover_original', 'cover_crop', 'social_cover']), ...$result['metadata'], 'local_path' => $result['asset']['path'], 'crop_source' => $source,
                            'cover_source' => $frame ? 'frame' : 'photo', 'video_crop' => $edit], 'frame_offset' => $nextOffset];
                    if ($frame) {
                        $attributes['thumbnail_url'] = $frame;
                    }
                    $video->update($attributes);
                });
            } catch (\Throwable $e) {
                $local->delete($result['asset']['path']);
                $local->delete($local->pathFromUrl($frame ?? null));
                throw $e;
            }
            $oldPath = $shortVideo->metadata['local_path'] ?? null;
            if ($oldPath && $oldPath !== ($source['path'] ?? null)) {
                $local->delete($oldPath);
            }
            if ($frame) {
                $local->delete($local->pathFromUrl($shortVideo->thumbnail_url));
            }

            return response()->json(['video' => $shortVideo->fresh(), 'changed' => true]);
        } finally {
            $lock->release();
        }
    }

    public function update(Request $r, ShortVideo $shortVideo, CloudinaryVideoService $cloud, LocalShortMedia $local)
    {
        $this->own($r, $shortVideo);
        $data = $r->validate(['cover_crop' => 'sometimes|array:mode,x,y,zoom|min:4', 'cover_crop.mode' => ['required_with:cover_crop', Rule::in(['fit', 'crop'])], 'cover_crop.x' => 'required_with:cover_crop|numeric|between:0,1', 'cover_crop.y' => 'required_with:cover_crop|numeric|between:0,1', 'cover_crop.zoom' => 'required_with:cover_crop|numeric|between:1,4', 'title' => 'nullable|string|max:255', 'description' => 'nullable|string|max:10000', 'frame_offset' => 'required|numeric|min:0', 'cover' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:5120', 'dimensions:max_width=4096,max_height=4096'], 'cover_mode' => ['required', Rule::in(['keep', 'frame', 'upload', 'photo'])]]);
        $lock = Cache::lock('short-crop:'.$shortVideo->id, 900);
        abort_unless($lock->get(), 409, 'Video sedang diproses. Tunggu sampai selesai.');
        try {
            $shortVideo->refresh();
            abort_unless($shortVideo->status === 'draft', 422, 'Hanya draf dapat diedit.');
            if ($data['frame_offset'] >= $shortVideo->metadata['duration']) {
                throw ValidationException::withMessages(['frame_offset' => 'Pilih bingkai sebelum video berakhir.']);
            }
            if ($data['cover_mode'] === 'upload' && ! $r->hasFile('cover')) {
                throw ValidationException::withMessages(['cover' => 'Pilih gambar sampul.']);
            }
            $localPath = $shortVideo->metadata['local_path'] ?? null;
            $originalCover = $shortVideo->metadata['cover_original'] ?? null;
            $coverEdit = $data['cover_crop'] ?? ['mode' => 'fit', 'x' => 0.5, 'y' => 0.5, 'zoom' => 1];
            $coverEdit = ['mode' => $coverEdit['mode'], ...array_map('floatval', Arr::only($coverEdit, ['x', 'y', 'zoom']))];
            if ($data['cover_mode'] === 'upload') {
                $originalCover = $local->cover($r->file('cover'));
            }
            $editingCover = $data['cover_mode'] === 'upload' || ($data['cover_mode'] === 'photo' && ($shortVideo->metadata['cover_source'] ?? 'frame') !== 'photo') || (in_array($data['cover_mode'], ['keep', 'photo']) && isset($data['cover_crop']) && $coverEdit != ($shortVideo->metadata['cover_crop'] ?? null));
            $cover = ['url' => $shortVideo->thumbnail_url, 'public_id' => $shortVideo->thumbnail_public_id];
            try {
                if ($editingCover) {
                    $cover = ['url' => $local->editCover($originalCover ?? $shortVideo->thumbnail_url, $coverEdit), 'public_id' => null];
                } elseif ($data['cover_mode'] === 'frame' && ! (($shortVideo->metadata['cover_source'] ?? null) === 'frame' && abs((float) $shortVideo->frame_offset - (float) $data['frame_offset']) < 0.001)) {
                    $cover = $localPath ? ['url' => $local->frame($localPath, (float) $data['frame_offset']), 'public_id' => null]
                        : $cloud->cover(null, $shortVideo->video_public_id, (float) $data['frame_offset']);
                }
            } catch (\Throwable $e) {
                if ($data['cover_mode'] === 'upload') {
                    $local->delete($local->pathFromUrl($originalCover));
                }
                throw $e;
            }
            try {
                DB::transaction(function () use ($shortVideo, $data, $cover, $originalCover, $coverEdit, $editingCover) {
                    $v = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
                    abort_unless($v->status === 'draft', 422);
                    $metadata = $v->metadata;
                    if ($editingCover) {
                        $metadata['cover_original'] = $originalCover ?? $v->thumbnail_url;
                        $metadata['cover_crop'] = $coverEdit;
                    }
                    $metadata['cover_source'] = $data['cover_mode'] === 'keep'
                        ? ($metadata['cover_source'] ?? (str_contains($v->thumbnail_url, '/video/upload/') ? 'frame' : 'photo'))
                        : ($data['cover_mode'] === 'frame' ? 'frame' : 'photo');
                    $v->update(['title' => $data['title'] ?? '', 'description' => $data['description'] ?? '', 'frame_offset' => $data['frame_offset'], 'thumbnail_url' => $cover['url'], 'thumbnail_public_id' => $cover['public_id'], 'metadata' => $metadata]);
                });
            } catch (\Throwable $e) {
                if ($cover['url'] !== $shortVideo->thumbnail_url) {
                    $local->delete($local->pathFromUrl($cover['url']));
                }
                if ($data['cover_mode'] === 'upload') {
                    $local->delete($local->pathFromUrl($originalCover));
                }
                throw $e;
            }
            if ($cover['url'] !== $shortVideo->thumbnail_url && $shortVideo->thumbnail_url !== $originalCover) {
                $local->delete($local->pathFromUrl($shortVideo->thumbnail_url));
            }
            if ($data['cover_mode'] === 'upload' && ($shortVideo->metadata['cover_original'] ?? null) !== $originalCover) {
                $local->delete($local->pathFromUrl($shortVideo->metadata['cover_original'] ?? null));
            }

            return response()->json(['video' => $shortVideo->fresh()]);
        } finally {
            $lock->release();
        }
    }

    private function targets(Request $r): array
    {
        $data = $r->validate(['platforms' => ['required', 'array', 'min:1', 'max:3'], 'platforms.*' => ['distinct', Rule::in(['website', 'instagram', 'facebook'])]]);
        if (! in_array('website', $data['platforms'])) {
            throw ValidationException::withMessages(['platforms' => 'ApaKhabar wajib dipilih.']);
        }

        return $data['platforms'];
    }

    private function fingerprint(ShortVideo $v, array $platforms): string
    {
        return hash('sha256', json_encode([$v->title, $v->description, $v->video_url, $v->thumbnail_url, $v->frame_offset, $platforms]));
    }

    public function preview(Request $r, ShortVideo $shortVideo, VideoInspector $inspector)
    {
        $this->own($r, $shortVideo);
        $platforms = $this->targets($r);
        $inspector->validate($shortVideo->metadata, $platforms);
        $caption = ReelCaption::format($shortVideo);
        if (in_array('instagram', $platforms) && mb_strlen($caption) > ReelCaption::INSTAGRAM_MAX) {
            throw ValidationException::withMessages(['description' => 'Judul dan deskripsi Instagram maksimal 2200 karakter.']);
        }
        if (in_array('facebook', $platforms) && mb_strlen($caption) > ReelCaption::FACEBOOK_MAX) {
            throw ValidationException::withMessages(['description' => 'Judul dan deskripsi Facebook maksimal 10000 karakter.']);
        }
        abort_unless(trim($shortVideo->title) && trim($shortVideo->description ?? ''), 422, 'Judul dan deskripsi wajib diisi.');
        $token = Str::random(48);
        Cache::put('short-preview:'.$token, ['user' => $r->user()->getKey(), 'video' => $shortVideo->id, 'fingerprint' => $this->fingerprint($shortVideo, $platforms)], now()->addMinutes(15));

        return response()->json(['token' => $token, 'title' => $shortVideo->title, 'content' => $shortVideo->description, 'caption' => $caption, 'category' => null, 'images' => array_fill_keys(['website', 'instagram', 'facebook'], null), 'issues' => [], 'video_url' => $shortVideo->video_url, 'thumbnail_url' => $shortVideo->thumbnail_url]);
    }

    public function publish(Request $r, ShortVideo $shortVideo, VideoInspector $inspector, CloudinaryVideoService $cloud, LocalShortMedia $local)
    {
        $this->own($r, $shortVideo);
        $platforms = $this->targets($r);
        $r->validate(['preview_token' => 'required|string']);
        $preview = Cache::get('short-preview:'.$r->input('preview_token'));
        if (! $preview || $preview['user'] !== $r->user()->getKey() || $preview['video'] !== $shortVideo->id || $preview['fingerprint'] !== $this->fingerprint($shortVideo, $platforms)) {
            throw ValidationException::withMessages(['preview_token' => 'Pratinjau berubah atau kedaluwarsa. Buka kembali pratinjau.']);
        }
        $inspector->validate($shortVideo->metadata, $platforms);
        $caption = ReelCaption::format($shortVideo);
        if (in_array('instagram', $platforms) && mb_strlen($caption) > ReelCaption::INSTAGRAM_MAX) {
            throw ValidationException::withMessages(['description' => 'Judul dan deskripsi Instagram maksimal 2200 karakter.']);
        }
        if (in_array('facebook', $platforms) && mb_strlen($caption) > ReelCaption::FACEBOOK_MAX) {
            throw ValidationException::withMessages(['description' => 'Judul dan deskripsi Facebook maksimal 10000 karakter.']);
        }
        $lock = Cache::lock('short-crop:'.$shortVideo->id, 900);
        abort_unless($lock->get(), 409, 'Video sedang diproses. Tunggu sampai selesai.');
        try {
            $shortVideo->refresh();
            abort_unless($preview['fingerprint'] === $this->fingerprint($shortVideo, $platforms), 422, 'Pratinjau berubah. Buka kembali pratinjau.');
            if ($shortVideo->status === 'published') {
                return $this->status($r, $shortVideo);
            }
            $social = (bool) array_intersect($platforms, ['instagram', 'facebook']);
            $metadata = $shortVideo->metadata;
            if ($social && ! empty($metadata['local_path'])) {
                $cached = $metadata['social_asset'] ?? null;
                if (! $cached || ($cached['source_path'] ?? null) !== $metadata['local_path']) {
                    // Upload before publishing; a failure leaves the local draft untouched.
                    $asset = $cloud->upload($local->file($metadata['local_path']));
                    $cached = ['source_path' => $metadata['local_path'], 'url' => $asset['secure_url'], 'public_id' => $asset['public_id']];
                }
                $cloud->assertUrl($cached['url']);
                $metadata['social_asset'] = $cached;
                DB::transaction(function () use ($shortVideo, $preview, $platforms, $metadata) {
                    $v = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
                    abort_unless($v->status === 'draft' && $preview['fingerprint'] === $this->fingerprint($v, $platforms), 422, 'Pratinjau berubah. Buka kembali pratinjau.');
                    $v->update(['metadata' => $metadata]);
                });
            } elseif ($social) {
                $cloud->assertUrl($shortVideo->video_url);
                $metadata['social_asset'] = ['url' => $shortVideo->video_url, 'public_id' => $shortVideo->video_public_id];
            }
            if (in_array('instagram', $platforms) && ($coverPath = $local->pathFromUrl($shortVideo->thumbnail_url))) {
                $cachedCover = $metadata['social_cover'] ?? null;
                if (! $cachedCover || ($cachedCover['source_url'] ?? null) !== $shortVideo->thumbnail_url) {
                    $file = new UploadedFile(Storage::disk('public')->path($coverPath), 'cover.jpg', 'image/jpeg', null, true);
                    $uploadedCover = $cloud->cover($file, $metadata['social_asset']['public_id'] ?? $shortVideo->video_public_id, (float) $shortVideo->frame_offset);
                    $cachedCover = ['source_url' => $shortVideo->thumbnail_url, 'url' => $uploadedCover['url']];
                }
                $cloud->assertUrl($cachedCover['url']);
                $metadata['social_cover'] = $cachedCover;
                $shortVideo->update(['metadata' => $metadata]);
            }
            DB::transaction(function () use ($shortVideo, $platforms, $r, $preview, $metadata) {
                $v = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
                if ($v->status === 'published') {
                    return;
                }
                abort_unless($v->status === 'draft' && $preview['fingerprint'] === $this->fingerprint($v, $platforms), 422);
                $v->update(['status' => 'published', 'published_at' => now(), 'metadata' => $metadata]);
                foreach ($platforms as $platform) {
                    $c = $platform === 'website' ? null : SocialConnection::where('user_id', $r->user()->getKey())->where('platform', $platform)->first();
                    $p = $v->publications()->create(['platform' => $platform, 'connection_id' => $c?->id, 'account_id' => $c?->account_id, 'account_name' => $c?->account_name,
                        'graph_host' => $c?->graphHost(), 'graph_version' => config($platform === 'facebook' ? 'services.facebook.graph_version' : 'services.instagram.graph_version'),
                        'credential' => $c?->access_token, 'credential_expires_at' => $c?->expires_at,
                        'status' => $platform === 'website' ? 'published' : ($c?->isConnected() ? 'queued' : 'failed'),
                        'stage' => $platform === 'website' ? 'done' : 'create', 'published_at' => $platform === 'website' ? now() : null,
                        'error_summary' => $platform !== 'website' && ! $c?->isConnected() ? 'Akun belum terhubung; ApaKhabar tetap diterbitkan.' : null, 'next_attempt_at' => now()]);
                    // Recovery scheduler also dispatches persisted queued records if queue insertion fails.
                    if ($p->status === 'queued') {
                        DB::afterCommit(function () use ($p) {
                            try {
                                PublishShortVideo::dispatch($p->id);
                            } catch (\Throwable) {
                            }
                        });
                    }
                }
            });
        } finally {
            $lock->release();
        }

        return $this->status($r, $shortVideo->fresh());
    }

    public function status(Request $r, ShortVideo $shortVideo)
    {
        $this->own($r, $shortVideo);
        $records = $shortVideo->publications()->get()->keyBy('platform');
        $results = [];
        $labels = ['published' => 'Berhasil', 'failed' => 'Gagal', 'processing' => 'Diproses', 'queued' => 'Menunggu', 'uncertain' => 'Belum pasti', 'not_selected' => 'Tidak Dipilih'];
        foreach (['website', 'instagram', 'facebook'] as $platform) {
            $p = $records->get($platform);
            $status = $p?->status ?? 'not_selected';
            $results[$platform] = ['success' => $status === 'published', 'status' => $status, 'message' => $p?->error_summary ?: $labels[$status], 'account' => $p?->account_name, 'permalink' => $p?->permalink];
        }

        return response()->json(['video' => $shortVideo->load('publications'), 'result' => ['pending' => $records->contains(fn ($p) => in_array($p->status, ['queued', 'processing'])), 'permalink_pending' => $records->contains(fn ($p) => $p->status === 'published' && $p->stage === 'permalink'), 'success' => $records->every(fn ($p) => $p->status === 'published'), 'attempt_id' => 'short-'.$shortVideo->id, 'results' => $results]]);
    }

    public function retry(Request $r, ShortVideo $shortVideo, string $platform)
    {
        $this->own($r, $shortVideo);
        abort_unless(in_array($platform, ['instagram', 'facebook']) && $shortVideo->status === 'published', 422);

        return DB::transaction(function () use ($r, $shortVideo, $platform) {
            $video = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
            abort_unless($video->status === 'published', 422);
            $p = $shortVideo->publications()->where('platform', $platform)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($p->status, ['failed', 'uncertain']) && (! $p->locked_until || $p->locked_until->isPast()), 422);
            abort_unless($p->can_retry || ($p->status === 'uncertain' && str_ends_with($p->stage, '_inflight')), 422);
            // Never replace a saved target with a newly selected account.
            $c = SocialConnection::where('user_id', $r->user()->getKey())->where('platform', $platform)->where('account_id', $p->account_id)->first();
            if ($c?->isConnected()) {
                $p->update(['credential' => $c->access_token, 'credential_expires_at' => $c->expires_at]);
            }
            if (! $p->account_id) {
                throw ValidationException::withMessages(['platform' => 'Tidak ada akun tujuan tersimpan. Publikasi ini tidak dapat diarahkan ke akun baru.']);
            }
            $p->update(['status' => 'queued', 'polls' => 0, 'next_attempt_at' => now(), 'error_summary' => null]);
            DB::afterCommit(fn () => PublishShortVideo::dispatch($p->id));

            return $this->status($r, $shortVideo);
        });
    }

    public function archive(Request $r, ShortVideo $shortVideo)
    {
        $this->own($r, $shortVideo);
        DB::transaction(function () use ($shortVideo) {
            $video = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
            abort_unless($video->status === 'published', 422);
            $pending = $video->publications()->whereIn('platform', ['instagram', 'facebook'])->get();
            abort_if($pending->contains(fn ($p) => in_array($p->status, ['queued', 'processing', 'uncertain']) || ($p->locked_until && $p->locked_until->isFuture()) || ($p->status === 'published' && $p->stage !== 'done')), 422, 'Tunggu publikasi sosial selesai atau rekonsiliasi status sebelum mengarsipkan video.');
            $video->update(['status' => 'archived']);
        });

        return response()->json(['message' => 'Video diarsipkan dari ApaKhabar. Postingan sosial yang sudah dikirim tidak dihapus.']);
    }

    public function restore(Request $r, ShortVideo $shortVideo)
    {
        $this->own($r, $shortVideo);
        DB::transaction(function () use ($shortVideo) {
            $video = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
            abort_unless($video->status === 'archived' && $video->publications()->where('platform', 'website')->where('status', 'published')->exists(), 422);
            $video->update(['status' => 'published']);
        });

        return response()->json(['message' => 'Video dipulihkan ke Beranda ApaKhabar.']);
    }

    public function retrySelected(Request $r, ShortVideo $shortVideo)
    {
        $this->own($r, $shortVideo);
        $data = $r->validate(['platforms' => 'required|array|min:1|max:2', 'platforms.*' => ['required', 'distinct', Rule::in(['instagram', 'facebook'])]]);

        return DB::transaction(function () use ($r, $shortVideo, $data) {
            $video = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
            abort_unless($video->status === 'published', 422);
            $records = $video->publications()->whereIn('platform', $data['platforms'])->orderBy('id')->lockForUpdate()->get();
            abort_unless($records->count() === count($data['platforms']) && $records->every(fn ($p) => $p->can_retry), 422, 'Platform yang dipilih tidak aman untuk dicoba kembali. Periksa status publikasi.');
            foreach ($records as $record) {
                $this->retry($r, $video, $record->platform);
            }

            return $this->status($r, $video);
        });
    }

    public function destroy(Request $r, ShortVideo $shortVideo, LocalShortMedia $local)
    {
        $this->own($r, $shortVideo);
        $lock = Cache::lock('short-crop:'.$shortVideo->id, 900);
        abort_unless($lock->get(), 409, 'Video sedang diproses. Tunggu sampai selesai.');
        try {
            DB::transaction(function () use ($shortVideo) {
                $video = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
                abort_unless($video->status === 'draft', 422, 'Arsipkan video yang sudah diterbitkan.');
                $video->delete();
            });
            $local->delete($shortVideo->metadata['local_path'] ?? null);
            $local->delete($shortVideo->metadata['crop_source']['path'] ?? null);
            $local->delete($local->pathFromUrl($shortVideo->metadata['cover_original'] ?? null));
            $local->delete($local->pathFromUrl($shortVideo->thumbnail_url));
        } finally {
            $lock->release();
        }

        return response()->json(['message' => 'Draf dihapus.']);
    }
}
