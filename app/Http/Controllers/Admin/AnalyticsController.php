<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsSetting;
use App\Models\NewsCategory;
use App\Models\SocialConnection;
use App\Services\Analytics\AnalyticsExport;
use App\Services\Analytics\AnalyticsReport;
use App\Services\Analytics\OperationalDashboard;
use App\Services\Analytics\PostPerformance;
use App\Services\Analytics\SectionLayout;
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
        $filters = $request->validate(['from' => ['sometimes', 'date_format:Y-m-d'], 'to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from'], 'source' => ['sometimes', Rule::in(['news', 'broadcast'])], 'platform' => ['sometimes', Rule::in(['all', 'web', 'mobile'])], 'search' => ['nullable', 'string', 'max:200'], 'category' => ['nullable', 'integer'], 'sort' => ['sometimes', Rule::in(['views', 'unique', 'likes', 'comments', 'ratio', 'newest'])], 'posts_page' => ['sometimes', 'integer', 'min:1'], 'post' => ['sometimes', 'integer', 'exists:news,postID'], 'export' => ['sometimes', Rule::in(['csv', 'xlsx'])], 'scope' => ['sometimes', Rule::in(['all', 'summary', 'audience', 'posts', 'broadcasts', 'social'])], 'export_post' => ['sometimes', 'integer', 'exists:news,postID']]);
        $from = $filters['from'] ?? now(config('analytics.timezone'))->subDays(29)->toDateString();
        $to = $filters['to'] ?? now(config('analytics.timezone'))->toDateString();
        if ($from > $to || CarbonImmutable::parse($from)->diffInDays($to) >= 366) {
            throw ValidationException::withMessages(['to' => 'Pilih periode berurutan maksimal 366 hari.']);
        }
        $source = $filters['source'] ?? 'news';
        $platform = $filters['platform'] ?? 'all';
        $setting = AnalyticsSetting::current();
        $layout = $setting->resolvedLayout();
        $widgets = $reports->build(array_values(array_unique([...$layout['order'], ...array_keys(AnalyticsReport::WIDGETS)])), $from, $to, $source, $platform, $layout['sizes']);
        if (isset($filters['export'])) {
            $export = app(AnalyticsExport::class);
            $sheets = $export->data($widgets, $from, $to, $filters['scope'] ?? 'all', isset($filters['export_post']) ? (int) $filters['export_post'] : null, $filters['search'] ?? '', (string) ($filters['category'] ?? ''), $filters['sort'] ?? 'views', $platform);
            $filename = 'analisis-'.(isset($filters['export_post']) ? 'berita-'.$filters['export_post'].'-' : '').$from.'-'.$to.'.'.$filters['export'];
            if ($filters['export'] === 'xlsx') {
                return response()->download($export->workbook($sheets, $from, $to), $filename, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control' => 'private, no-store'])->deleteFileAfterSend(true);
            }

            return response()->streamDownload(function () use ($export, $sheets) {
                $stream = fopen('php://output', 'w');
                $export->csv($sheets, $stream);
                fclose($stream);
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'private, no-store']);
        }
        $interactionTrend = app(PostPerformance::class)->interactionTrend($from, $to);
        $active = $request->query('section', $request->query('tab', 'summary'));
        $activeTab = $active === 'activity' ? 'audience' : (in_array($active, ['summary', 'audience', 'posts', 'broadcasts', 'social'], true) ? $active : 'summary');

        return Inertia::render('admin/analytics', [
            'widgets' => $widgets,
            'posts' => app(PostPerformance::class)->listing($filters['search'] ?? '', (string) ($filters['category'] ?? ''), $filters['sort'] ?? 'views', (int) ($filters['posts_page'] ?? 1), 15, $from, $to),
            'selectedPost' => isset($filters['post']) ? app(PostPerformance::class)->selected((int) $filters['post'], $from, $to) : null,
            'activeTab' => $activeTab,
            'reportingTimezone' => config('analytics.timezone'),
            'interactionTrend' => $interactionTrend,
            'inspection' => isset($filters['post']) ? app(PostPerformance::class)->inspection((int) $filters['post'], $from, $to) : null,
            'postFilters' => ['search' => $filters['search'] ?? '', 'category' => (string) ($filters['category'] ?? ''), 'sort' => $filters['sort'] ?? 'views'],
            'newsCategories' => NewsCategory::orderBy('name')->get(['categoryID', 'name']),
            'filters' => compact('from', 'to', 'source', 'platform'),
            'catalog' => AnalyticsReport::WIDGETS,
            'configuration' => [
                'widgets' => $setting->widgets,
                'period_days' => $setting->period_days,
                'layout' => $setting->resolvedSections(),
                'updated_at' => $setting->updated_at?->toIso8601String(),
                'meta_connection_ids' => $setting->meta_connection_ids ?? [],
            ],
            'connections' => SocialConnection::where('user_id', $request->user()->getKey())->get(['id', 'platform', 'account_name'])->toArray(),
        ])->toResponse($request)->header('Cache-Control', 'private, no-store');
    }

    public function dashboard(Request $request, AnalyticsReport $reports)
    {
        abort_unless($request->user()->isAdmin() || $request->user()->isModerator(), 403);
        $from = now(config('analytics.timezone'))->subDays(29)->toDateString();
        $to = now(config('analytics.timezone'))->toDateString();

        return Inertia::render('admin/dashboard', [
            'operational' => app(OperationalDashboard::class)->build($request->user(), $from, $to),
            'period' => compact('from', 'to'),
        ])->toResponse($request)->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);
        $validKeys = array_keys(AnalyticsReport::WIDGETS);
        $data = $request->validate([
            'fixed_categories' => ['sometimes', 'boolean'],
            'widgets' => ['present', 'array', 'max:9'],
            'widgets.*' => ['string', 'distinct', Rule::in($validKeys)],
            'period_days' => ['required', 'integer', Rule::in([7, 14, 30, 90, 180, 365])],
            'layout' => ['sometimes', 'array'],
            'layout.version' => ['sometimes', 'integer', Rule::in([2])],
            'layout.sections' => ['present_if:layout.version,2', 'array', 'max:20'],
            'layout.sections.*' => ['array:id,title,order,columns,widgets'],
            'layout.sections.*.id' => ['required', 'string', 'max:80', 'distinct', 'regex:/^[a-zA-Z0-9_-]+$/'],
            'layout.sections.*.title' => ['present', 'nullable', 'string', 'max:80'],
            'layout.sections.*.order' => ['required', 'integer', 'min:0', 'max:19', 'distinct'],
            'layout.sections.*.columns' => ['required', 'integer', Rule::in([1, 2, 3])],
            'layout.sections.*.widgets' => ['present', 'array', 'max:9'],
            'layout.sections.*.widgets.*' => ['array:id,size,order'],
            'layout.sections.*.widgets.*.id' => ['required', 'string', 'distinct', Rule::in($validKeys)],
            'layout.sections.*.widgets.*.size' => ['required', Rule::in(['small', 'medium', 'wide', 'large'])],
            'layout.sections.*.widgets.*.order' => ['required', 'integer', 'min:0', 'max:8'],
            'layout.grid' => ['sometimes', 'array:'.implode(',', $validKeys)],
            'layout.grid.*' => ['array:x,y,w,h'],
            'layout.grid.*.x' => ['required', 'integer', 'min:0', 'max:8'],
            'layout.grid.*.y' => ['required', 'integer', 'min:0', 'max:1000'],
            'layout.grid.*.w' => ['required', 'integer', 'min:4', 'max:12'],
            'layout.grid.*.h' => ['required', 'integer', 'min:4', 'max:100'],
            'layout.order' => ['sometimes', 'array', 'max:9'],
            'layout.order.*' => ['string', 'distinct', Rule::in($validKeys)],
            'layout.sizes' => ['sometimes', 'array'],
            'layout.sizes.*.span' => ['sometimes', 'integer', Rule::in([1, 2])],
            'layout.sizes.*.height' => ['sometimes', 'string', Rule::in(['sm', 'md', 'lg'])],
        ]);

        if (isset($data['layout']['sections']) && ($data['layout']['version'] ?? null) !== 2) {
            throw ValidationException::withMessages(['layout.version' => 'Versi tata letak harus 2.']);
        }
        foreach ($data['layout']['sections'] ?? [] as $i => $section) {
            $orders = array_column($section['widgets'], 'order');
            if (count($orders) !== count(array_unique($orders))) {
                throw ValidationException::withMessages(["layout.sections.$i.widgets" => 'Urutan widget harus unik.']);
            }
            foreach ($section['widgets'] as $j => $widget) {
                if (SectionLayout::compatible($widget['id'], $widget['size'], $section['columns']) !== $widget['size']) {
                    throw ValidationException::withMessages(["layout.sections.$i.widgets.$j.size" => 'Ukuran widget tidak didukung dalam bagian ini.']);
                }
            }
        }
        if (($data['layout']['version'] ?? null) === 2) {
            $data['layout'] = SectionLayout::resolve($data['layout']);
        }

        if ($data['fixed_categories'] ?? false) {
            $data['layout'] = SectionLayout::categories($data['layout'] ?? AnalyticsSetting::current()->resolvedSections());
        }

        foreach ($data['layout']['grid'] ?? [] as $id => $cell) {
            if ($cell['x'] + $cell['w'] > 12) {
                throw ValidationException::withMessages(['layout.grid.'.$id => 'Kartu harus berada dalam 12 kolom.']);
            }
        }

        DB::transaction(function () use ($data, $request) {
            $setting = AnalyticsSetting::current();
            if (($data['layout']['version'] ?? null) === 2 && $setting->layout && (($setting->layout['version'] ?? null) !== 2 || (($data['fixed_categories'] ?? false) && array_diff(array_column($setting->resolvedSections()['sections'], 'id'), array_keys(SectionLayout::CATEGORIES))))) {
                DB::table('analytics_setting_changes')->insert([
                    'user_id' => $request->user()->getKey(),
                    'configuration' => json_encode(['migration_backup' => true, 'layout' => $setting->layout, 'widgets' => $setting->widgets, 'period_days' => $setting->period_days]),
                    'created_at' => now(),
                ]);
            }
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
