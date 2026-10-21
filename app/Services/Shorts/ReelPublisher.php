<?php

namespace App\Services\Shorts;

use App\Models\ShortVideoPublication;
use Illuminate\Support\Facades\Http;

class ReelPublisher
{
    private function request(ShortVideoPublication $p, string $method, string $path, array $data = []): array
    {
        $base = 'https://'.$p->graph_host.'/'.$p->graph_version.'/';
        $http = Http::withoutRedirecting()->connectTimeout(10)->timeout(45)->withToken($p->credential);
        $response = $method === 'get' ? $http->get($base.$path, $data) : $http->asForm()->post($base.$path, $data);
        if ($response->clientError()) {
            throw new MetaVideoRejected('Meta menolak permintaan (kode '.(int) $response->json('error.code', 0).').');
        }
        if (! $response->successful() || ! is_array($response->json())) {
            throw new \RuntimeException('Meta menolak permintaan (HTTP '.$response->status().', kode '.(int) $response->json('error.code', 0).').');
        }

        return $response->json();
    }

    private function id(array $data, string $key = 'id'): string
    {
        if (! preg_match('/^\d+$/', (string) ($data[$key] ?? ''))) {
            throw new \RuntimeException('Meta tidak mengembalikan ID media yang valid.');
        }

        return (string) $data[$key];
    }

    private function mutate(ShortVideoPublication $p, string $stage, callable $call): array
    {
        // Commit intent before HTTP: worker termination or timeout must never blindly repeat a write.
        $p->update(['stage' => $stage.'_inflight', 'status' => 'processing']);
        try {
            return $call();
        } catch (MetaVideoRejected $e) {
            $p->update(['stage' => $stage, 'status' => 'failed', 'error_summary' => $e->getMessage()]);
            throw $e;
        } catch (\Throwable $e) {
            $p->update(['status' => 'uncertain', 'error_summary' => 'Hasil permintaan Meta belum pasti. Periksa status sebelum mencoba lagi.']);
            throw $e;
        }
    }

    public function step(ShortVideoPublication $p): void
    {
        $video = $p->video;
        if ($p->status === 'published' && $p->stage === 'permalink') {
            // Metadata-only reads must never turn a successful publication into a failure.
            if (! $p->credential || ($p->credential_expires_at && $p->credential_expires_at->isPast())) {
                throw new \RuntimeException('Token akun tujuan tidak tersedia untuk membaca tautan.');
            }
            $field = $p->platform === 'instagram' ? 'permalink' : 'permalink_url';
            $data = $this->request($p, 'get', $p->media_id, ['fields' => $field]);
            $url = PublicationPermalink::normalize($p->platform, $data[$field] ?? null);
            if ($url) {
                $p->update(['permalink' => $url, 'stage' => 'done', 'error_summary' => null]);
            } else {
                $p->update(['error_summary' => 'Diterbitkan; tautan belum tersedia.']);
            }

            return;
        }
        if (! $p->credential || ($p->credential_expires_at && $p->credential_expires_at->isPast())) {
            $p->update(['status' => 'failed', 'error_summary' => 'Token akun tujuan kedaluwarsa. Hubungkan kembali akun yang sama.']);

            return;
        }
        if (str_ends_with($p->stage, '_inflight')) {
            $p->update(['status' => 'uncertain', 'error_summary' => 'Permintaan sebelumnya belum pasti; tidak dikirim ulang untuk mencegah duplikasi.']);
            $this->reconcile($p);

            return;
        }
        if ($p->stage === 'create') {
            $data = $this->mutate($p, 'create', fn () => $this->request($p, 'post', $p->account_id.($p->platform === 'instagram' ? '/media' : '/video_reels'),
                $p->platform === 'instagram' ? ['media_type' => 'REELS', 'video_url' => $video->video_url, 'caption' => ReelCaption::format($video), 'cover_url' => $video->thumbnail_url]
                    : ['upload_phase' => 'start']));
            $p->update(['container_id' => $this->id($data, $p->platform === 'instagram' ? 'id' : 'video_id'), 'stage' => $p->platform === 'instagram' ? 'wait' : 'upload', 'status' => 'processing']);

            return;
        }
        if ($p->platform === 'facebook' && $p->stage === 'upload') {
            $this->mutate($p, 'upload', function () use ($p, $video) {
                $response = Http::withoutRedirecting()->connectTimeout(10)->timeout(45)->withHeaders(['Authorization' => 'OAuth '.$p->credential, 'file_url' => $video->video_url])
                    ->post('https://rupload.facebook.com/video-upload/'.$p->graph_version.'/'.$p->container_id);
                if (! $response->successful() || $response->json('success') !== true) {
                    throw new \RuntimeException('Transfer video Facebook belum dikonfirmasi.');
                }

                return $response->json();
            });
            $p->update(['stage' => 'finish', 'status' => 'processing']);

            return;
        }
        if ($p->platform === 'facebook' && $p->stage === 'finish') {
            $data = $this->mutate($p, 'finish', fn () => $this->request($p, 'post', $p->account_id.'/video_reels', ['upload_phase' => 'finish', 'video_id' => $p->container_id, 'video_state' => 'PUBLISHED', 'title' => $video->title, 'description' => ReelCaption::format($video)]));
            if (($data['success'] ?? false) !== true) {
                throw new \RuntimeException('Finalisasi Facebook belum dikonfirmasi.');
            }
            $p->update(['stage' => 'wait', 'status' => 'processing']);

            return;
        }
        if ($p->platform === 'instagram') {
            $data = $this->request($p, 'get', $p->container_id, ['fields' => 'status_code']);
            if (($data['status_code'] ?? '') === 'FINISHED') {
                $published = $this->mutate($p, 'publish', fn () => $this->request($p, 'post', $p->account_id.'/media_publish', ['creation_id' => $p->container_id]));
                $this->complete($p, $this->id($published));
            } elseif (in_array($data['status_code'] ?? '', ['ERROR', 'EXPIRED'])) {
                $p->update(['status' => 'failed', 'stage' => 'create', 'container_id' => null, 'error_summary' => 'Pemrosesan Instagram gagal atau kontainer kedaluwarsa.']);
            }
        } else {
            $this->reconcile($p);
        }
    }

    public function reconcile(ShortVideoPublication $p): void
    {
        if (! $p->container_id) {
            return;
        }
        if ($p->platform === 'facebook') {
            $data = $this->request($p, 'get', $p->container_id, ['fields' => 'status']);
            if (data_get($data, 'status.publishing_phase.status') === 'complete') {
                $this->complete($p, $p->container_id);
            } elseif (data_get($data, 'status.video_status') === 'error') {
                $p->update(['status' => 'failed', 'error_summary' => 'Pemrosesan Facebook gagal.']);
            } elseif ($p->stage === 'upload_inflight' && data_get($data, 'status.uploading_phase.status') === 'complete') {
                $p->update(['stage' => 'finish', 'status' => 'processing', 'error_summary' => null]);
            }
        } elseif ($p->stage === 'publish_inflight') {
            // A published container confirms a post exists, but does not reliably recover its media ID.
            $data = $this->request($p, 'get', $p->container_id, ['fields' => 'status_code']);
            if (($data['status_code'] ?? '') === 'PUBLISHED') {
                $p->update(['error_summary' => 'Meta mengonfirmasi kontainer sudah diterbitkan. ID media perlu direkonsiliasi; jangan terbitkan ulang.']);
            }
        }
    }

    private function complete(ShortVideoPublication $p, string $id): void
    {
        $p->update(['media_id' => $id, 'status' => 'published', 'stage' => 'permalink', 'published_at' => now(), 'error_summary' => null, 'polls' => 0]);
    }
}
