export type WidgetSize = 'small' | 'medium' | 'wide' | 'large';
export type SectionWidget = { id: string; size: WidgetSize; order: number };
export type DashboardSection = {
    id: string;
    title: string;
    order: number;
    columns: number;
    widgets: SectionWidget[];
};
export type SectionLayout = { version: 2; sections: DashboardSection[] };
export const supportedSizes: Record<string, WidgetSize[]> = {
    overview: ['wide', 'large', 'medium', 'small'],
    categories: ['wide', 'large', 'medium', 'small'],
    age: ['medium', 'large', 'small', 'wide'],
    citizenship: ['medium', 'large', 'small', 'wide'],
    ethnicity: ['wide', 'small', 'medium', 'large'],
    activity: ['wide', 'large', 'medium', 'small'],
    broadcast: ['wide', 'small', 'medium', 'large'],
    meta: ['wide', 'large', 'medium', 'small'],
    engagement: ['wide', 'small', 'medium', 'large'],
};
export const footprints: Record<WidgetSize, [number, number]> = {
    small: [1, 1],
    medium: [1, 2],
    wide: [2, 1],
    large: [2, 2],
};
export function compatible(
    id: string,
    size: WidgetSize,
    columns: number,
): WidgetSize {
    const allowed = supportedSizes[id] ?? ['medium'];
    const valid = allowed.includes(size) ? size : allowed[0];

    return columns === 1 && footprints[valid][0] === 2
        ? valid === 'wide' && allowed.includes('small')
            ? 'small'
            : 'medium'
        : valid;
}
export function normalize(layout: SectionLayout): SectionLayout {
    return {
        version: 2,
        sections: layout.sections.map((s, i) => ({
            ...s,
            order: i,
            widgets: s.widgets.map((w, j) => ({
                ...w,
                order: j,
                size: compatible(w.id, w.size, s.columns),
            })),
        })),
    };
}
export function defaultSections(): SectionLayout {
    const groups: [string, string, string[]][] = [
        ['overview', 'Ringkasan', ['overview']],
        [
            'demographics',
            'Demografi warga',
            ['age', 'citizenship', 'ethnicity'],
        ],
        ['publishing', 'Publikasi', ['categories', 'broadcast']],
        ['engagement', 'Aktivitas & keterlibatan', ['activity', 'engagement']],
        ['social', 'Media sosial', ['meta']],
    ];

    return {
        version: 2,
        sections: groups.map(([id, title, ids], order) => ({
            id,
            title,
            order,
            columns: 2,
            widgets: ids.map((id, order) => ({
                id,
                order,
                size: supportedSizes[id][0],
            })),
        })),
    };
}
// Monotonic row-major first fit: never place a later widget before an earlier one.
export function pack(widgets: SectionWidget[], columns: number) {
    const occupied = new Set<string>();
    let cursor = 0;

    return widgets.map((widget) => {
        const size = compatible(widget.id, widget.size, columns);
        const [w, h] = footprints[size];
        let x = 0,
            y = 0;

        for (;;) {
            x = cursor % columns;
            y = Math.floor(cursor / columns);
            let fits = x + w <= columns;

            for (let dy = 0; dy < h; dy++) {
                for (let dx = 0; dx < w; dx++) {
                    if (occupied.has(`${x + dx},${y + dy}`)) {
                        fits = false;
                    }
                }
            }

            if (fits) {
                break;
            }

            cursor++;
        }

        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                occupied.add(`${x + dx},${y + dy}`);
            }
        }

        cursor++;

        return { ...widget, size, x, y, w, h };
    });
}
export function moveWidget(
    layout: SectionLayout,
    id: string,
    target: string,
    before?: string,
): SectionLayout {
    const widget = layout.sections
        .flatMap((s) => s.widgets)
        .find((w) => w.id === id);

    if (
        !widget ||
        !layout.sections.some((s) => s.id === target) ||
        before === id
    ) {
        return layout;
    }

    return normalize({
        ...layout,
        sections: layout.sections.map((s) => {
            const widgets = s.widgets.filter((w) => w.id !== id);

            if (s.id === target) {
                const index = widgets.findIndex((w) => w.id === before);
                widgets.splice(index < 0 ? widgets.length : index, 0, widget);
            }

            return { ...s, widgets };
        }),
    });
}

/** Shared sizing contract: 260px rows, 16px gaps, at most 2 × 2. */
export const ROW_HEIGHT = 260;
export const GRID_GAP = 16;
export function resizePreset(
    size: WidgetSize,
    dx: number,
    dy: number,
    columnWidth: number,
    columns: number,
): WidgetSize {
    const [w, h] = footprints[size];
    const wide = columns > 1 && w + dx / (columnWidth + GRID_GAP) >= 1.5;
    const tall = h + dy / (ROW_HEIGHT + GRID_GAP) >= 1.5;

    return wide ? (tall ? 'large' : 'wide') : tall ? 'medium' : 'small';
}
