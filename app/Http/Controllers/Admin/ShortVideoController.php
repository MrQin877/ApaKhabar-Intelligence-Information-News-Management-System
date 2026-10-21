<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\PublishShortVideo;
use App\Models\ShortVideo;
use App\Models\SocialConnection;
use App\Services\News\MetaConnections;
use App\Services\Shorts\CloudinaryVideoService;
use App\Services\Shorts\VideoInspector;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
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

    public function upload(Request $r, VideoInspector $inspector, CloudinaryVideoService $cloud)
    {
        $r->validate(['video' => ['required', 'file', 'mimetypes:video/mp4', 'extensions:mp4', 'max:'.config('shorts.max_upload_kb')]]);
        $metadata = $inspector->inspect($r->file('video'));
        $asset = $cloud->upload($r->file('video'));
        $video = ShortVideo::create(['created_by' => $r->user()->getKey(), 'video_url' => $asset['secure_url'], 'video_public_id' => $asset['public_id'], 'thumbnail_url' => $cloud->frame($asset['public_id'], 0), 'metadata' => $metadata]);

        return response()->json(['video' => $video], 201);
    }

    public function update(Request $r, ShortVideo $shortVideo, CloudinaryVideoService $cloud)
    {
        $this->own($r, $shortVideo);
        $data = $r->validate(['title' => 'required|string|max:255', 'description' => 'required|string|max:10000', 'frame_offset' => 'required|numeric|min:0', 'cover' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:5120', 'dimensions:max_width=4096,max_height=4096'], 'cover_mode' => ['required', Rule::in(['keep', 'frame', 'upload'])]]);
        abort_unless($shortVideo->status === 'draft', 422, 'Hanya draf dapat diedit.');
        if ($data['frame_offset'] >= $shortVideo->metadata['duration']) {
            throw ValidationException::withMessages(['frame_offset' => 'Pilih bingkai sebelum video berakhir.']);
        }
        if ($data['cover_mode'] === 'upload' && ! $r->hasFile('cover')) {
            throw ValidationException::withMessages(['cover' => 'Pilih gambar sampul.']);
        }
        $cover = $data['cover_mode'] === 'keep' ? ['url' => $shortVideo->thumbnail_url, 'public_id' => $shortVideo->thumbnail_public_id] : $cloud->cover($r->file('cover'), $shortVideo->video_public_id, (float) $data['frame_offset']);
        DB::transaction(function () use ($shortVideo, $data, $cover) {
            $v = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
            abort_unless($v->status === 'draft', 422);
            $v->update(['title' => $data['title'], 'description' => $data['description'], 'frame_offset' => $data['frame_offset'], 'thumbnail_url' => $cover['url'], 'thumbnail_public_id' => $cover['public_id']]);
        });

        return response()->json(['video' => $shortVideo->fresh()]);
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
        if (in_array('instagram', $platforms) && mb_strlen($shortVideo->description) > 2200) {
            throw ValidationException::withMessages(['description' => 'Deskripsi Instagram maksimal 2200 karakter.']);
        }
        abort_unless(trim($shortVideo->title) && trim($shortVideo->description), 422, 'Judul dan deskripsi wajib diisi.');
        $token = Str::random(48);
        Cache::put('short-preview:'.$token, ['user' => $r->user()->getKey(), 'video' => $shortVideo->id, 'fingerprint' => $this->fingerprint($shortVideo, $platforms)], now()->addMinutes(15));

        return response()->json(['token' => $token, 'title' => $shortVideo->title, 'content' => $shortVideo->description, 'caption' => $shortVideo->description, 'category' => null, 'images' => array_fill_keys(['website', 'instagram', 'facebook'], null), 'issues' => [], 'video_url' => $shortVideo->video_url, 'thumbnail_url' => $shortVideo->thumbnail_url]);
    }

    public function publish(Request $r, ShortVideo $shortVideo, VideoInspector $inspector)
    {
        $this->own($r, $shortVideo);
        $platforms = $this->targets($r);
        $r->validate(['preview_token' => 'required|string']);
        $preview = Cache::get('short-preview:'.$r->input('preview_token'));
        if (! $preview || $preview['user'] !== $r->user()->getKey() || $preview['video'] !== $shortVideo->id || $preview['fingerprint'] !== $this->fingerprint($shortVideo, $platforms)) {
            throw ValidationException::withMessages(['preview_token' => 'Pratinjau berubah atau kedaluwarsa. Buka kembali pratinjau.']);
        }
        $inspector->validate($shortVideo->metadata, $platforms);
        DB::transaction(function () use ($shortVideo, $platforms, $r, $preview) {
            $v = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
            if ($v->status === 'published') {
                return;
            }
            abort_unless($v->status === 'draft' && $preview['fingerprint'] === $this->fingerprint($v, $platforms), 422);
            $v->update(['status' => 'published', 'published_at' => now()]);
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

        return response()->json(['video' => $shortVideo->load('publications'), 'result' => ['pending' => $records->contains(fn ($p) => in_array($p->status, ['queued', 'processing']) || ($p->status === 'published' && $p->stage === 'permalink')), 'success' => $records->every(fn ($p) => $p->status === 'published'), 'attempt_id' => 'short-'.$shortVideo->id, 'results' => $results]]);
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

    public function destroy(Request $r, ShortVideo $shortVideo)
    {
        $this->own($r, $shortVideo);
        DB::transaction(function () use ($shortVideo) {
            $video = ShortVideo::whereKey($shortVideo->id)->lockForUpdate()->firstOrFail();
            abort_unless($video->status === 'draft', 422, 'Arsipkan video yang sudah diterbitkan.');
            $video->delete();
        });

        return response()->json(['message' => 'Draf dihapus.']);
    }
}
