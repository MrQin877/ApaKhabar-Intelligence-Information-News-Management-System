<?php

namespace App\Services\Analytics;

use App\Models\AnalyticsSetting;
use App\Models\Broadcast;
use App\Models\News;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class AnalyticsReport
{
    public const WIDGETS = [
        'overview' => 'Ringkasan warga', 'categories' => 'Kategori & tren publikasi',
        'age' => 'Kelompok usia', 'citizenship' => 'Kewarganegaraan',
        'ethnicity' => 'Suku / Etnis', 'activity' => 'Waktu aktif warga',
        'broadcast' => 'Ringkasan siaran', 'meta' => 'Facebook & Instagram', 'engagement' => 'Engagement',
    ];

    public function allowed(User $user, string $widget): bool
    {
        return $user->isAdmin() || ($user->isModerator() && in_array($widget, AnalyticsSetting::current()->widgets, true));
    }

    public function build(array $widgets, string $from, string $to, string $source = 'news', string $platform = 'all', array $sizes = []): array
    {
        $zone = config('analytics.timezone');
        $start = CarbonImmutable::parse($from, $zone)->startOfDay()->utc();
        $end = CarbonImmutable::parse($to, $zone)->endOfDay()->utc();
        $recordStart = $start->timezone(config('app.timezone'));
        $recordEnd = $end->timezone(config('app.timezone'));
        $villagers = fn () => User::whereHas('roleRecord', fn ($q) => $q->where('name', 'villager'));
        $activity = fn () => DB::table('villager_activity_hours')->whereBetween('hour', [$start, $end])
            ->whereIn('user_id', $villagers()->select('userID'))
            ->when($platform !== 'all', fn ($q) => $q->where('platform', $platform));
        $result = [];
        foreach ($widgets as $widget) {
            // Compute only authorized widgets. No hidden payload is sent to moderators.
            $data = match ($widget) {
                'overview' => ['rows' => [
                    ['label' => 'Warga terdaftar saat ini', 'value' => $villagers()->count()],
                    ['label' => 'Pendaftaran dalam periode', 'value' => $villagers()->whereBetween('created_at', [$recordStart, $recordEnd])->count()],
                    ['label' => 'Warga aktif dalam periode', 'value' => $activity()->distinct()->count('user_id')],
                    ['label' => 'Profil lengkap (lahir & kewarganegaraan)', 'value' => $villagers()->whereNotNull('date_of_birth')->whereNotNull('citizenship')->count()],
                ], 'note' => 'Populasi akun terdaftar, bukan sensus penduduk. Profil dihitung saat ini.'],
                'categories' => $this->categories($source, $recordStart, $recordEnd),
                'age' => $this->ages($villagers()->get(['date_of_birth'])),
                'citizenship' => $this->citizenship($villagers()),
                'ethnicity' => ['rows' => $villagers()->select('ethnicity')->selectRaw('count(*) as total')->groupBy('ethnicity')->get()->map(fn ($r) => ['label' => $r->ethnicity ?: 'Belum mengisi', 'value' => (int) $r->total])->all(), 'note' => 'Profil saat ini; jawaban sukarela.'],
                'activity' => $this->activity($activity()->select('user_id', 'hour')->distinct()->get(), $zone),
                'broadcast' => $this->broadcast($recordStart, $recordEnd),
                'meta' => app(MetaInsights::class)->report($from, $to),
                'engagement' => ['rows' => [], 'note' => 'Segera hadir — disiapkan untuk integrasi modul engagement.'],
                default => null,
            };
            if ($data !== null) {
                $size = $sizes[$widget] ?? [
                    'span' => in_array($widget, ['categories', 'activity'], true) ? 2 : 1,
                    'height' => 'md',
                ];
                $result[] = [
                    'id' => $widget,
                    'title' => self::WIDGETS[$widget],
                    'span' => $size['span'] ?? 1,
                    'height' => $size['height'] ?? 'md',
                    'grid' => $size['grid'] ?? null,
                    ...$data,
                ];
            }
        }

        return $result;
    }

    private function categories(string $source, $start, $end): array
    {
        $query = $source === 'broadcast'
            ? Broadcast::with('categoryRecord')->whereNotNull('sent_at')->whereBetween('sent_at', [$start, $end])
            : News::with('categoryRecord')->whereBetween('created_at', [$start, $end]);
        $posts = $query->get();
        $rows = $posts->groupBy(fn ($p) => $p->categoryRecord?->name ?? 'Tanpa kategori')->map(fn ($group, $label) => [
            'label' => $label, 'value' => $group->count(),
            ...($source === 'news' ? ['lifetime_views' => (int) $group->sum('view')] : []),
        ])->values()->all();
        $trend = $posts->groupBy(fn ($p) => ($source === 'broadcast' ? $p->sent_at : $p->created_at)->copy()->timezone(config('analytics.timezone'))->format('Y-m-d'))
            ->map(fn ($group, $label) => ['label' => $label, 'value' => $group->count()])->sortBy('label')->values()->all();

        return ['rows' => $rows, 'trend' => $trend, 'note' => $source === 'news'
            ? 'Berita dibuat dalam periode, termasuk yang kini diarsipkan. Tayangan adalah total seumur hidup, bukan pembaca unik atau tayangan dalam periode.'
            : 'Siaran terkirim dalam periode, termasuk yang kini diarsipkan.'];
    }

    private function ages($users): array
    {
        $counts = array_fill_keys(['<18', '18–24', '25–34', '35–44', '45–54', '55–64', '65+', 'Belum mengisi'], 0);
        $today = CarbonImmutable::now(config('analytics.timezone'))->startOfDay();
        foreach ($users as $user) {
            $age = $user->date_of_birth ? (int) CarbonImmutable::parse($user->date_of_birth->format('Y-m-d'), config('analytics.timezone'))->diffInYears($today) : null;
            $label = match (true) {
                $age === null => 'Belum mengisi', $age < 18 => '<18', $age < 25 => '18–24', $age < 35 => '25–34', $age < 45 => '35–44', $age < 55 => '45–54', $age < 65 => '55–64', default => '65+'
            };
            $counts[$label]++;
        }

        return ['rows' => collect($counts)->map(fn ($n, $label) => ['label' => $label, 'value' => $n])->values()->all(), 'note' => 'Usia saat ini berdasarkan tanggal lahir. Semua warga terdaftar, termasuk profil belum lengkap.'];
    }

    private function citizenship($query): array
    {
        $groups = $query->select('citizenship', 'gender')->selectRaw('count(*) as total')->groupBy('citizenship', 'gender')->get();
        $total = $groups->sum('total');
        $rows = [];
        foreach (['wni' => 'WNI', 'wna' => 'WNA', 'dual' => 'Dua Kewarganegaraan', '' => 'Belum mengisi'] as $key => $label) {
            $group = $groups->filter(fn ($r) => ($r->citizenship ?? '') === $key);
            $n = (int) $group->sum('total');
            $male = (int) $group->where('gender', 'male')->sum('total');
            $female = (int) $group->where('gender', 'female')->sum('total');
            $rows[] = ['label' => $label, 'value' => $n, 'percent' => $total ? round($n / $total * 100, 2) : 0, 'male' => $male, 'female' => $female, 'unspecified' => $n - $male - $female];
        }

        return ['rows' => $rows, 'note' => 'Persentase dari seluruh warga terdaftar saat ini. Jenis kelamin yang kosong atau tidak disebutkan tetap dihitung.'];
    }

    private function activity($events, string $zone): array
    {
        $buckets = [];
        $days = [];
        foreach ($events as $event) {
            $local = CarbonImmutable::parse($event->hour, 'UTC')->timezone($zone);
            $key = $local->dayOfWeekIso.'-'.$local->hour;
            $buckets[$key][$event->user_id] = true;
            $days[$local->format('Y-m-d')][$event->user_id] = true;
        }
        $heatmap = [];
        for ($day = 1; $day <= 7; $day++) {
            for ($hour = 0; $hour < 24; $hour++) {
                $heatmap[] = ['day' => $day, 'hour' => $hour, 'value' => count($buckets[$day.'-'.$hour] ?? [])];
            }
        }
        ksort($days);

        return ['rows' => collect($days)->map(fn ($people, $label) => ['label' => $label, 'value' => count($people)])->values()->all(), 'heatmap' => $heatmap,
            'note' => 'Warga unik per hari/jam minggu dalam periode (bukan jumlah klik). Zona waktu: '.$zone.'. Pelacakan dimulai '.AnalyticsSetting::current()->tracking_started_at->timezone($zone)->format('d M Y').'.'];
    }

    private function broadcast($start, $end): array
    {
        $ids = Broadcast::whereBetween('sent_at', [$start, $end])->pluck('alertID')->map(fn ($id) => (string) $id);
        $sent = 0;
        $read = 0;
        DB::table('notifications')->select('data', 'read_at')->orderBy('notificationID')->chunk(500, function ($rows) use ($ids, &$sent, &$read) {
            foreach ($rows as $row) {
                $data = json_decode($row->data, true);
                if (isset($data['broadcast_id']) && $ids->containsStrict((string) $data['broadcast_id'])) {
                    $sent++;
                    if ($row->read_at) {
                        $read++;
                    }
                }
            }
        });

        return ['rows' => [['label' => 'Siaran terkirim', 'value' => $ids->count()], ['label' => 'Notifikasi tercatat', 'value' => $sent], ['label' => 'Notifikasi dibaca', 'value' => $read]], 'note' => 'Status baca saat ini untuk siaran dalam periode. Notifikasi tercatat bukan bukti pengiriman perangkat atau keselamatan penerima.'];
    }
}
