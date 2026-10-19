<?php

namespace App\Services\Analytics;

use App\Models\AnalyticsSetting;
use App\Models\SocialConnection;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class MetaInsights
{
    public function sync(): void
    {
        foreach (SocialConnection::whereIn('id', AnalyticsSetting::current()->meta_connection_ids ?? [])->get() as $connection) {
            if (! $connection->isConnected()) {
                $connection->update(['insights_status' => 'disconnected']);

                continue;
            }
            $metric = $connection->platform === 'instagram' ? 'reach' : config('analytics.facebook_metric', 'page_views_total');
            try {
                // Seven days are refreshed to pick up delayed provider corrections. Never follow remote paging URLs containing tokens.
                $response = Http::withToken($connection->access_token)->acceptJson()->timeout(20)->get('https://'.$connection->graphHost().'/'.config('meta.graph_version').'/'.rawurlencode($connection->account_id).'/insights', [
                    'metric' => $metric, 'period' => 'day', 'since' => now('UTC')->subDays(7)->startOfDay()->timestamp, 'until' => now('UTC')->startOfDay()->timestamp,
                    ...($connection->platform === 'instagram' ? ['metric_type' => 'time_series'] : []),
                ]);
                if (! $response->successful()) {
                    $connection->update(['insights_status' => 'unavailable']);

                    continue;
                }
                $series = collect($response->json('data', []))->first(fn ($row) => ($row['name'] ?? null) === $metric && ($row['period'] ?? null) === 'day');
                $points = [];
                foreach (($series['values'] ?? []) as $point) {
                    if (! isset($point['end_time']) || ! is_int($point['value'] ?? null) || $point['value'] < 0) {
                        continue;
                    }
                    $points[] = ['connection_id' => $connection->id, 'account_id' => $connection->account_id, 'metric' => $metric, 'period' => 'day', 'period_end' => CarbonImmutable::parse($point['end_time'])->utc()->format('Y-m-d H:i:s'), 'value' => $point['value'], 'synced_at' => now('UTC')];
                }
                if (! $points) {
                    $connection->update(['insights_status' => 'no_data']);

                    continue;
                }
                // Do not attach an in-flight response to a newly selected account using the same connection row.
                DB::transaction(function () use ($connection, $points) {
                    $current = SocialConnection::lockForUpdate()->find($connection->id);
                    if (! $current || ! $current->isConnected() || $current->account_id !== $connection->account_id || $current->access_token !== $connection->access_token) {
                        return;
                    }
                    DB::table('meta_insight_snapshots')->upsert($points, ['connection_id', 'account_id', 'metric', 'period_end'], ['value', 'synced_at']);
                    $current->update(['insights_status' => 'ready', 'insights_synced_at' => now()]);
                });
            } catch (\Throwable) {
                // Provider exception messages may contain tokens. Only persist a safe status.
                SocialConnection::whereKey($connection->id)->where('account_id', $connection->account_id)->update(['insights_status' => 'unavailable']);
            }
        }
    }

    public function report(string $from, string $to): array
    {
        $connections = SocialConnection::whereIn('id', AnalyticsSetting::current()->meta_connection_ids ?? [])->get()->keyBy('platform');
        $accounts = [];
        foreach (['facebook', 'instagram'] as $platform) {
            $connection = $connections->get($platform);
            $status = ! $connection ? 'not_selected' : (! $connection->isConnected() ? 'disconnected' : ($connection->insights_status ?? 'pending'));
            $points = $connection ? DB::table('meta_insight_snapshots')->where('connection_id', $connection->id)->where('account_id', $connection->account_id)
                ->where('metric', $platform === 'instagram' ? 'reach' : config('analytics.facebook_metric', 'page_views_total'))
                ->where('period_end', '>', CarbonImmutable::parse($from, 'UTC')->startOfDay())->where('period_end', '<=', CarbonImmutable::parse($to, 'UTC')->addDay()->startOfDay())->orderBy('period_end')->get() : collect();
            $accounts[] = ['platform' => $platform, 'account' => $connection?->account_name, 'status' => $status, 'last_sync' => $connection?->insights_synced_at?->toIso8601String(),
                'rows' => $points->map(fn ($p) => ['label' => CarbonImmutable::parse($p->period_end, 'UTC')->subSecond()->format('Y-m-d').' · '.($platform === 'instagram' ? 'Jangkauan harian' : 'Kunjungan Halaman'), 'value' => (int) $p->value])->all(),
                'note' => match ($status) {
                    'not_selected' => 'Akun resmi belum dipilih.','disconnected' => 'Koneksi terputus atau token kedaluwarsa.','pending' => 'Menunggu sinkronisasi pertama.','no_data' => 'Meta tidak mengembalikan data untuk metrik ini.','ready' => 'Data harian tersedia. Tanggal mengikuti periode Meta (akhir periode UTC); hari tanpa data tidak ditampilkan sebagai nol.',default => 'Sinkronisasi gagal. Periksa izin Insights, token, dan dukungan metrik; data tersimpan mungkin sudah lama.'
                },
            ];
        }

        return ['rows' => [], 'accounts' => $accounts, 'note' => 'Platform dilaporkan terpisah. Jangkauan harian tidak dijumlahkan menjadi orang unik bulanan. Riwayat dimulai dari data yang berhasil disinkronkan.'];
    }
}
