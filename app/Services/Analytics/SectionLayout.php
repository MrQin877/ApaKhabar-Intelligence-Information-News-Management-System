<?php

namespace App\Services\Analytics;

class SectionLayout
{
    public const SIZES = [
        'overview' => ['wide', 'large', 'medium', 'small'],
        'categories' => ['wide', 'large', 'medium', 'small'],
        'age' => ['medium', 'large', 'small', 'wide'],
        'citizenship' => ['medium', 'large', 'small', 'wide'],
        'ethnicity' => ['wide', 'small', 'medium', 'large'],
        'activity' => ['wide', 'large', 'medium', 'small'],
        'broadcast' => ['wide', 'small', 'medium', 'large'],
        'meta' => ['wide', 'large', 'medium', 'small'],
        'engagement' => ['wide', 'small', 'medium', 'large'],
    ];

    public static function compatible(string $id, string $size, int $columns): string
    {
        if (! in_array($size, self::SIZES[$id], true)) {
            $size = self::SIZES[$id][0];
        }
        if ($columns === 1 && in_array($size, ['wide', 'large'], true)) {
            return $size === 'wide' && in_array('small', self::SIZES[$id], true) ? 'small' : 'medium';
        }

        return $size;
    }

    public static function defaults(): array
    {
        $groups = [
            ['overview', 'Ringkasan', ['overview']],
            ['demographics', 'Demografi warga', ['age', 'citizenship', 'ethnicity']],
            ['publishing', 'Publikasi', ['categories', 'broadcast']],
            ['engagement', 'Aktivitas & keterlibatan', ['activity', 'engagement']],
            ['social', 'Media sosial', ['meta']],
        ];

        return ['version' => 2, 'sections' => array_map(fn ($g, $i) => [
            'id' => $g[0], 'title' => $g[1], 'order' => $i, 'columns' => 2,
            'widgets' => array_map(fn ($id, $j) => ['id' => $id, 'size' => self::SIZES[$id][0], 'order' => $j], $g[2], array_keys($g[2])),
        ], $groups, array_keys($groups))];
    }

    public static function resolve(?array $raw): array
    {
        if (($raw['version'] ?? null) !== 2) {
            if (! $raw) {
                return self::defaults();
            }
            $ids = array_values(array_unique(array_filter($raw['order'] ?? [], fn ($id) => is_string($id) && isset(self::SIZES[$id]))));
            $ids = array_values(array_unique([...$ids, ...array_keys(self::SIZES)]));

            return ['version' => 2, 'sections' => [[
                'id' => 'migrated', 'title' => 'Analisis', 'order' => 0, 'columns' => 2,
                'widgets' => array_map(function ($id, $i) use ($raw) {
                    $wide = ($raw['grid'][$id]['w'] ?? (($raw['sizes'][$id]['span'] ?? 1) * 6)) > 6;
                    $tall = ($raw['grid'][$id]['h'] ?? 6) > 6;
                    $size = $wide ? ($tall ? 'large' : 'wide') : ($tall ? 'medium' : 'small');

                    return ['id' => $id, 'size' => self::compatible($id, $size, 2), 'order' => $i];
                }, $ids, array_keys($ids)),
            ]]];
        }
        $sections = is_array($raw['sections'] ?? null) ? array_values(array_filter($raw['sections'], 'is_array')) : [];
        usort($sections, fn ($a, $b) => ($a['order'] ?? 0) <=> ($b['order'] ?? 0));
        $result = [];
        $seen = [];
        $sectionIds = [];
        foreach (array_slice($sections, 0, 20) as $section) {
            if (! is_array($section) || ! is_string($section['id'] ?? null) || isset($sectionIds[$section['id']])) {
                continue;
            }
            $sectionIds[$section['id']] = true;
            $columns = max(1, min(3, (int) ($section['columns'] ?? 2)));
            $widgets = is_array($section['widgets'] ?? null) ? array_values(array_filter($section['widgets'], 'is_array')) : [];
            usort($widgets, fn ($a, $b) => ($a['order'] ?? 0) <=> ($b['order'] ?? 0));
            $items = [];
            foreach ($widgets as $widget) {
                $id = $widget['id'] ?? '';
                if (! is_string($id) || ! isset(self::SIZES[$id]) || isset($seen[$id])) {
                    continue;
                }
                $seen[$id] = true;
                $items[] = ['id' => $id, 'size' => self::compatible($id, (string) ($widget['size'] ?? ''), $columns), 'order' => count($items)];
            }
            $result[] = ['id' => $section['id'], 'title' => mb_substr((string) ($section['title'] ?? ''), 0, 80), 'order' => count($result), 'columns' => $columns, 'widgets' => $items];
        }

        return ['version' => 2, 'sections' => $result];
    }

    public static function visible(array $layout, array $allowed): array
    {
        $sections = [];
        foreach ($layout['sections'] as $section) {
            $section['widgets'] = array_values(array_filter($section['widgets'], fn ($w) => in_array($w['id'], $allowed, true)));
            if (! $section['widgets']) {
                continue;
            }
            foreach ($section['widgets'] as $i => &$widget) {
                $widget['order'] = $i;
            }
            unset($widget);
            $section['order'] = count($sections);
            $sections[] = $section;
        }

        return ['version' => 2, 'sections' => $sections];
    }
}
