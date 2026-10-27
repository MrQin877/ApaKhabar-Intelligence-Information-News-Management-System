<?php

namespace App\Models;

use App\Services\Analytics\AnalyticsReport;
use App\Services\Analytics\SectionLayout;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class AnalyticsSetting extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'widgets' => 'array',
            'layout' => 'array',
            'tracking_started_at' => 'datetime',
            'meta_connection_ids' => 'array',
        ];
    }

    public static function current(): self
    {
        return static::findOrFail(1);
    }

    public function resolvedSections(): array
    {
        $raw = $this->layout;
        if (! is_array($raw)) {
            $saved = DB::table('analytics_setting_changes')->orderByDesc('id')->value('configuration');
            $raw = is_string($saved) ? (json_decode($saved, true)['layout'] ?? null) : null;
        }

        return SectionLayout::resolve($raw);
    }

    public function resolvedLayout(): array
    {
        $allKeys = array_keys(AnalyticsReport::WIDGETS);
        $defaultSizes = [];
        foreach ($allKeys as $key) {
            $defaultSizes[$key] = [
                'span' => in_array($key, ['categories', 'activity'], true) ? 2 : 1,
                'height' => 'md',
            ];
        }

        $raw = $this->layout;
        if (! is_array($raw)) {
            $latestChange = DB::table('analytics_setting_changes')
                ->orderByDesc('id')
                ->value('configuration');
            if (is_string($latestChange)) {
                $decoded = json_decode($latestChange, true);
                if (isset($decoded['layout']) && is_array($decoded['layout'])) {
                    $raw = $decoded['layout'];
                }
            }
        }

        $savedOrder = is_array($raw['order'] ?? null) ? $raw['order'] : [];
        $validOrder = array_values(array_intersect($savedOrder, $allKeys));
        $missing = array_values(array_diff($allKeys, $validOrder));
        $order = [...$validOrder, ...$missing];

        $sizes = $defaultSizes;
        if (is_array($raw['sizes'] ?? null)) {
            foreach ($raw['sizes'] as $key => $cfg) {
                if (! isset($sizes[$key]) || ! is_array($cfg)) {
                    continue;
                }
                $span = isset($cfg['span']) && in_array((int) $cfg['span'], [1, 2], true)
                    ? (int) $cfg['span']
                    : $sizes[$key]['span'];
                $height = isset($cfg['height']) && in_array($cfg['height'], ['sm', 'md', 'lg'], true)
                    ? $cfg['height']
                    : $sizes[$key]['height'];
                $sizes[$key] = ['span' => $span, 'height' => $height];
            }
        }

        $grid = [];
        $x = 0;
        $y = 0;
        foreach ($order as $key) {
            if ($key === 'overview') {
                continue;
            }
            $width = $sizes[$key]['span'] === 2 ? 12 : 6;
            if ($x + $width > 12) {
                $x = 0;
                $y += 6;
            }
            $saved = $raw['grid'][$key] ?? null;
            $grid[$key] = is_array($saved) && isset($saved['x'], $saved['y'], $saved['w'], $saved['h'])
                ? ['x' => min(12 - max(4, min(12, (int) $saved['w'])), max(0, (int) $saved['x'])),
                    'y' => max(0, min(1000, (int) $saved['y'])),
                    'w' => max(4, min(12, (int) $saved['w'])),
                    'h' => max(4, min(100, (int) $saved['h']))]
                : ['x' => $x, 'y' => $y, 'w' => $width, 'h' => 6];
            $sizes[$key]['grid'] = $grid[$key];
            $x += $width;
            if ($x === 12) {
                $x = 0;
                $y += 6;
            }
        }

        return ['order' => $order, 'sizes' => $sizes, 'grid' => $grid];
    }
}
