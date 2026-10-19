<?php

namespace App\Models;

use App\Services\Analytics\AnalyticsReport;
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

        return [
            'order' => $order,
            'sizes' => $sizes,
        ];
    }
}
