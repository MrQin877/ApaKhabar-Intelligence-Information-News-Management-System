<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsSetting;
use App\Models\SocialConnection;
use App\Services\Analytics\AnalyticsReport;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class AnalyticsController extends Controller
{
    public function index(Request $request, AnalyticsReport $reports)
    {
        abort_unless($request->user()->isAdmin(), 403);
        $filters = $request->validate(['from' => ['sometimes', 'date_format:Y-m-d'], 'to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from'], 'source' => ['sometimes', Rule::in(['news', 'broadcast'])], 'platform' => ['sometimes', Rule::in(['all', 'web', 'mobile'])]]);
        $from = $filters['from'] ?? now(config('analytics.timezone'))->subDays(29)->toDateString();
        $to = $filters['to'] ?? now(config('analytics.timezone'))->toDateString();
        if ($from > $to || CarbonImmutable::parse($from)->diffInDays($to) >= 366) {
            throw ValidationException::withMessages(['to' => 'Pilih periode berurutan maksimal 366 hari.']);
        }
        $source = $filters['source'] ?? 'news';
        $platform = $filters['platform'] ?? 'all';
        $setting = AnalyticsSetting::current();
        $layout = $setting->resolvedLayout();
        $widgets = $reports->build($layout['order'], $from, $to, $source, $platform, $layout['sizes']);
        if ($request->query('export') === 'csv') {
            return response()->streamDownload(function () use ($widgets, $from, $to) {
                $stream = fopen('php://output', 'w');
                fwrite($stream, "\xEF\xBB\xBF");
                fputcsv($stream, ['Laporan', 'Kelompok', 'Jumlah', 'Persen', 'Laki-laki', 'Perempuan', 'Tidak disebutkan', 'Tayangan seumur hidup', 'Dari', 'Sampai', 'Catatan'], ',', '"', '');
                $safe = fn ($value) => is_string($value) && preg_match('/^[\s]*[=+@-]/u', $value) ? "'".$value : $value;
                foreach ($widgets as $widget) {
                    $rows = $widget['rows'];
                    foreach ($widget['accounts'] ?? [] as $account) {
                        foreach ($account['rows'] as $row) {
                            $rows[] = [...$row, 'label' => $account['platform'].' / '.$row['label']];
                        }
                    }
                    foreach ($rows as $row) {
                        fputcsv($stream, array_map($safe, [$widget['title'], $row['label'], $row['value'], $row['percent'] ?? '', $row['male'] ?? '', $row['female'] ?? '', $row['unspecified'] ?? '', $row['lifetime_views'] ?? '', $from, $to, $widget['note']]), ',', '"', '');
                    }
                }
                fclose($stream);
            }, 'analisis-'.$from.'-'.$to.'.csv', ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'private, no-store']);
        }

        return Inertia::render('admin/analytics', [
            'widgets' => $widgets,
            'filters' => compact('from', 'to', 'source', 'platform'),
            'catalog' => AnalyticsReport::WIDGETS,
            'configuration' => [
                'widgets' => $setting->widgets,
                'period_days' => $setting->period_days,
                'layout' => $layout,
                'updated_at' => $setting->updated_at?->toIso8601String(),
                'meta_connection_ids' => $setting->meta_connection_ids ?? [],
            ],
            'connections' => SocialConnection::where('user_id', $request->user()->getKey())->get(['id', 'platform', 'account_name'])->toArray(),
        ])->toResponse($request)->header('Cache-Control', 'private, no-store');
    }

    public function dashboard(Request $request, AnalyticsReport $reports)
    {
        $setting = AnalyticsSetting::current();
        $layout = $setting->resolvedLayout();
        $keys = $request->user()->isAdmin() ? $layout['order'] : $setting->widgets;
        $from = now(config('analytics.timezone'))->subDays($setting->period_days - 1)->toDateString();
        $to = now(config('analytics.timezone'))->toDateString();

        return Inertia::render('admin/dashboard', [
            'widgets' => $reports->build($keys, $from, $to, 'news', 'all', $layout['sizes']),
            'period' => compact('from', 'to'),
        ])->toResponse($request)->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);
        $validKeys = array_keys(AnalyticsReport::WIDGETS);
        $data = $request->validate([
            'widgets' => ['present', 'array', 'max:9'],
            'widgets.*' => ['string', 'distinct', Rule::in($validKeys)],
            'period_days' => ['required', 'integer', Rule::in([7, 14, 30, 90, 180, 365])],
            'layout' => ['sometimes', 'array'],
            'layout.order' => ['sometimes', 'array', 'max:9'],
            'layout.order.*' => ['string', 'distinct', Rule::in($validKeys)],
            'layout.sizes' => ['sometimes', 'array'],
            'layout.sizes.*.span' => ['sometimes', 'integer', Rule::in([1, 2])],
            'layout.sizes.*.height' => ['sometimes', 'string', Rule::in(['sm', 'md', 'lg'])],
        ]);

        if (isset($data['layout']['order'])) {
            $orderMap = array_flip($data['layout']['order']);
            usort(
                $data['widgets'],
                fn (string $a, string $b) => ($orderMap[$a] ?? 999) <=> ($orderMap[$b] ?? 999),
            );
        }

        DB::transaction(function () use ($data, $request) {
            $setting = AnalyticsSetting::current();
            $updatePayload = [
                'widgets' => $data['widgets'],
                'period_days' => $data['period_days'],
                'updated_by' => $request->user()->getKey(),
            ];
            if (isset($data['layout']) && Schema::hasColumn('analytics_settings', 'layout')) {
                $updatePayload['layout'] = $data['layout'];
            }
            $setting->update($updatePayload);
            DB::table('analytics_setting_changes')->insert([
                'user_id' => $request->user()->getKey(),
                'configuration' => json_encode($data),
                'created_at' => now(),
            ]);
        });

        return back();
    }
}
