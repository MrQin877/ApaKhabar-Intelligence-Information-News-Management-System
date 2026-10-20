type ReportRow = { label: string; value: number };
export function groupMetrics(rows: ReportRow[]) {
    const groups = new Map<string, ReportRow[]>();
    rows.forEach((row) => {
        const match = /^(\d{4}-\d{2}-\d{2})\s*·\s*(.+)$/.exec(row.label);
        const metric = match?.[2] ?? row.label;
        const points = groups.get(metric) ?? [];
        points.push({ label: match?.[1] ?? row.label, value: row.value });
        groups.set(metric, points);
    });

    return [...groups].map(([metric, rows]) => ({
        metric,
        rows: [...rows].sort((a, b) => a.label.localeCompare(b.label)),
    }));
}

export function notificationReadRate(
    read: number,
    recorded: number,
): number | null {
    return recorded > 0 ? (read / recorded) * 100 : null;
}
