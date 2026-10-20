import {
    Activity,
    ArrowUpRight,
    Bell,
    ChartNoAxesCombined,
    Clock3,
    MailCheck,
    Radio,
    Share2,
    Users,
} from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    XAxis,
    YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { groupMetrics, notificationReadRate } from '@/lib/analytics-chart-data';
import type { WidgetSize } from '@/lib/analytics-sections';
import type { ReportRow, ReportWidget } from './report-widgets';

const CHART_PALETTE = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-5)',
    'var(--chart-4)',
    'var(--info-400)',
    'var(--violet-500)',
    'var(--greyscale-500)',
];

const count = (value: number) => value.toLocaleString('id-ID');

const BRAND_COLORS: Record<
    string,
    { color: string; label: string; metricLabel: string }
> = {
    facebook: {
        color: '#1877F2',
        label: 'Facebook',
        metricLabel: 'Kunjungan Halaman Harian',
    },
    instagram: {
        color: '#E1306C',
        label: 'Instagram',
        metricLabel: 'Jangkauan Harian (Reach)',
    },
};

const STATUS_LABELS: Record<
    string,
    {
        text: string;
        variant: 'default' | 'secondary' | 'destructive' | 'outline';
    }
> = {
    ready: { text: 'Tersinkron', variant: 'default' },
    pending: { text: 'Menunggu Sinkronisasi', variant: 'secondary' },
    not_selected: { text: 'Belum Dipilih', variant: 'outline' },
    disconnected: { text: 'Terputus', variant: 'destructive' },
    no_data: { text: 'Tidak Ada Data', variant: 'secondary' },
    unavailable: { text: 'Gagal Sinkron', variant: 'destructive' },
};

function Empty({ note }: { note: string }) {
    return (
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/15 px-4 py-6 text-center text-muted-foreground">
            <ChartNoAxesCombined className="size-6 shrink-0 opacity-40" />
            <p className="text-xs font-medium">{note}</p>
        </div>
    );
}

export function OverviewKpiGrid({ rows }: { rows: ReportRow[] }) {
    const totalVillagers = rows[0]?.value ?? 0;
    const icons = [Users, ArrowUpRight, Activity, Clock3];
    const kpiColors = [
        'text-primary bg-primary/10 border-primary/20',
        'text-teal-500 bg-teal-500/10 border-teal-500/20',
        'text-warning-500 bg-warning-500/10 border-warning-500/20',
        'text-violet-500 bg-violet-500/10 border-violet-500/20',
    ];

    return (
        <div className="analytics-kpis grid gap-4">
            {rows.map((row, i) => {
                const Icon = icons[i % icons.length];
                const showRatio = (i === 2 || i === 3) && totalVillagers > 0;
                const ratio = showRatio
                    ? Math.round((row.value / totalVillagers) * 100)
                    : null;

                return (
                    <Card
                        key={row.label}
                        className="min-w-0 gap-0 overflow-hidden py-0 shadow-xs"
                    >
                        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
                            <CardTitle className="text-xs font-medium break-words text-muted-foreground sm:text-sm">
                                {row.label}
                            </CardTitle>
                            <span
                                className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg border ${kpiColors[i % kpiColors.length]}`}
                            >
                                <Icon className="size-4" />
                            </span>
                        </CardHeader>
                        <CardContent className="px-4 py-3.5">
                            <div className="flex items-baseline justify-between gap-2">
                                <p className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
                                    {count(row.value)}
                                </p>
                                {ratio !== null && (
                                    <Badge
                                        variant="secondary"
                                        className="text-xs tabular-nums"
                                    >
                                        {ratio}% warga
                                    </Badge>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {i === 0 || i === 3
                                    ? 'Profil warga saat ini'
                                    : 'Dalam periode terpilih'}
                            </p>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

export function TimeChart({
    rows,
    color = 'var(--chart-1)',
    metric = 'Jumlah',
    height = 200,
    area = true,
    miniature = false,
}: {
    rows: ReportRow[];
    color?: string;
    metric?: string;
    height?: number;
    area?: boolean;
    miniature?: boolean;
}) {
    const gradient = useId().replace(/:/g, '');

    if (!rows.length || !rows.some((r) => r.value > 0)) {
        return (
            <div
                className="flex items-center text-xs text-muted-foreground"
                style={{ height }}
            >
                Belum ada pengamatan dalam periode ini.
            </div>
        );
    }

    const chartConfig = {
        value: { label: metric, color },
    } satisfies ChartConfig;

    const formattedRows = rows.map((r) => ({
        ...r,
        shortLabel: /^\d{4}-\d{2}-\d{2}/.test(r.label)
            ? r.label.slice(5, 10)
            : r.label,
    }));

    return (
        <ChartContainer
            config={chartConfig}
            className="analytics-plot aspect-auto w-full min-w-0"
            style={{ height }}
        >
            {area ? (
                <AreaChart
                    accessibilityLayer
                    data={formattedRows}
                    margin={{
                        left: miniature ? 2 : -8,
                        right: miniature ? 2 : 12,
                        top: miniature ? 3 : 10,
                        bottom: 0,
                    }}
                >
                    <defs>
                        <linearGradient
                            id={gradient}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="5%"
                                stopColor={color}
                                stopOpacity={0.35}
                            />
                            <stop
                                offset="95%"
                                stopColor={color}
                                stopOpacity={0.02}
                            />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        hide={miniature}
                        dataKey="shortLabel"
                        minTickGap={24}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                    />
                    <YAxis
                        hide={miniature}
                        width={36}
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                    />
                    <ChartTooltip
                        content={
                            <ChartTooltipContent
                                indicator="line"
                                labelFormatter={(_, payload) =>
                                    payload?.[0]?.payload?.label ?? ''
                                }
                            />
                        }
                    />
                    <Area
                        dataKey="value"
                        name="value"
                        type="monotone"
                        stroke={color}
                        strokeWidth={2.5}
                        fill={`url(#${gradient})`}
                        dot={rows.length === 1}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                    />
                </AreaChart>
            ) : (
                <BarChart
                    accessibilityLayer
                    data={formattedRows}
                    margin={{
                        left: miniature ? 2 : -8,
                        right: miniature ? 2 : 12,
                        top: miniature ? 3 : 10,
                        bottom: 0,
                    }}
                >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        hide={miniature}
                        dataKey="shortLabel"
                        minTickGap={24}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                    />
                    <YAxis
                        hide={miniature}
                        width={36}
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                    />
                    <ChartTooltip
                        content={
                            <ChartTooltipContent
                                labelFormatter={(_, payload) =>
                                    payload?.[0]?.payload?.label ?? ''
                                }
                            />
                        }
                    />
                    <Bar
                        dataKey="value"
                        name="value"
                        fill={color}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={42}
                        isAnimationActive={false}
                    />
                </BarChart>
            )}
        </ChartContainer>
    );
}

function HorizontalDistribution({
    rows,
    tall = false,
}: {
    rows: ReportRow[];
    tall?: boolean;
}) {
    const total = rows.reduce((n, r) => n + r.value, 0);

    if (!rows.length || total === 0) {
        return <Empty note="Belum ada data kelompok." />;
    }

    const chartConfig = {
        value: { label: 'Jumlah', color: 'var(--chart-1)' },
    } satisfies ChartConfig;

    const sorted = [...rows].sort((a, b) => b.value - a.value);
    const plotHeight = Math.max(tall ? 240 : 170, sorted.length * 36);

    return (
        <div className="space-y-4">
            <ChartContainer
                config={chartConfig}
                className="aspect-auto w-full min-w-0"
                style={{ height: plotHeight }}
            >
                <BarChart
                    accessibilityLayer
                    layout="vertical"
                    data={sorted}
                    margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
                >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                        type="number"
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        type="category"
                        dataKey="label"
                        width={116}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip
                        content={<ChartTooltipContent labelKey="label" />}
                    />
                    <Bar
                        dataKey="value"
                        name="value"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={24}
                        isAnimationActive={false}
                    >
                        {sorted.map((entry, index) => (
                            <Cell
                                key={`${entry.label}-${index}`}
                                fill={
                                    entry.label === 'Belum mengisi'
                                        ? 'var(--muted-foreground)'
                                        : CHART_PALETTE[
                                              index % CHART_PALETTE.length
                                          ]
                                }
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ChartContainer>

            <div className="flex flex-wrap gap-2 border-t pt-3">
                {sorted.map((row, i) => {
                    const pct = total
                        ? Math.round((row.value / total) * 100)
                        : 0;
                    const color =
                        row.label === 'Belum mengisi'
                            ? 'var(--muted-foreground)'
                            : CHART_PALETTE[i % CHART_PALETTE.length];

                    return (
                        <div
                            key={`${row.label}-${i}`}
                            className="inline-flex items-center gap-2 rounded-lg border bg-muted/20 px-2.5 py-1 text-xs"
                        >
                            <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ background: color }}
                            />
                            <span className="font-medium break-words">
                                {row.label}
                            </span>
                            <strong className="font-semibold tabular-nums">
                                {count(row.value)}
                            </strong>
                            <span className="text-muted-foreground tabular-nums">
                                ({pct}%)
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function AgeDonut({
    rows,
    tall = false,
}: {
    rows: ReportRow[];
    tall?: boolean;
}) {
    const total = rows.reduce((n, r) => n + r.value, 0);
    const hasData = total > 0;

    const chartConfig = Object.fromEntries(
        rows.map((r, i) => [
            r.label,
            {
                label: r.label,
                color:
                    r.label === 'Belum mengisi'
                        ? 'var(--muted-foreground)'
                        : CHART_PALETTE[i % CHART_PALETTE.length],
            },
        ]),
    ) satisfies ChartConfig;

    const donutSize = tall ? 'h-52 w-52' : 'h-44 w-44';

    return (
        <div className="analytics-donut-layout">
            <div
                className={`relative mx-auto shrink-0 transition-all duration-200 ${donutSize}`}
            >
                <ChartContainer
                    config={chartConfig}
                    className="aspect-square h-full w-full"
                >
                    <PieChart accessibilityLayer>
                        <ChartTooltip
                            content={<ChartTooltipContent nameKey="label" />}
                        />
                        <Pie
                            data={
                                hasData
                                    ? rows
                                    : [{ label: 'Belum ada data', value: 1 }]
                            }
                            dataKey="value"
                            nameKey="label"
                            innerRadius="64%"
                            outerRadius="90%"
                            paddingAngle={2}
                            stroke="none"
                            isAnimationActive={false}
                        >
                            {(hasData
                                ? rows
                                : [{ label: 'empty', value: 1 }]
                            ).map((r, i) => (
                                <Cell
                                    key={r.label}
                                    fill={
                                        !hasData
                                            ? 'var(--muted)'
                                            : r.label === 'Belum mengisi'
                                              ? 'var(--muted-foreground)'
                                              : CHART_PALETTE[
                                                    i % CHART_PALETTE.length
                                                ]
                                    }
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <strong className="text-2xl font-bold tabular-nums">
                        {count(total)}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                        warga terdaftar
                    </span>
                </div>
            </div>

            <div className="analytics-legend grid w-full min-w-0 flex-1 grid-cols-2 gap-2">
                {rows.map((row, i) => {
                    const pct = total
                        ? Math.round((row.value / total) * 100)
                        : 0;
                    const color =
                        row.label === 'Belum mengisi'
                            ? 'var(--muted-foreground)'
                            : CHART_PALETTE[i % CHART_PALETTE.length];

                    return (
                        <div
                            key={row.label}
                            className="rounded-lg border bg-muted/15 p-2.5"
                        >
                            <div className="flex items-center justify-between gap-1.5 text-xs">
                                <span className="flex items-center gap-1.5 font-medium break-words">
                                    <span
                                        className="size-2.5 shrink-0 rounded-sm"
                                        style={{ background: color }}
                                    />
                                    {row.label}
                                </span>
                                <span className="font-semibold tabular-nums">
                                    {count(row.value)}
                                </span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            background: color,
                                            width: `${pct}%`,
                                        }}
                                    />
                                </div>
                                <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">
                                    {pct}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Citizenship({
    rows,
    tall = false,
}: {
    rows: ReportRow[];
    tall?: boolean;
}) {
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    const gender = {
        male: { label: 'Laki-laki', color: 'var(--chart-1)' },
        female: { label: 'Perempuan', color: 'var(--chart-2)' },
        unspecified: {
            label: 'Belum / tidak disebutkan',
            color: 'var(--chart-3)',
        },
    } satisfies ChartConfig;

    return (
        <div className="space-y-4">
            {total > 0 ? (
                <ChartContainer
                    config={gender}
                    className="aspect-auto w-full min-w-0"
                    style={{ height: tall ? 240 : 185 }}
                >
                    <BarChart
                        accessibilityLayer
                        layout="vertical"
                        data={rows}
                        margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
                    >
                        <CartesianGrid
                            horizontal={false}
                            strokeDasharray="3 3"
                        />
                        <XAxis
                            type="number"
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            type="category"
                            dataKey="label"
                            width={105}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) =>
                                v === 'Dua Kewarganegaraan'
                                    ? 'Ganda'
                                    : v === 'Belum mengisi'
                                      ? 'Belum diisi'
                                      : v
                            }
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend
                            content={
                                <ChartLegendContent className="flex-wrap text-xs" />
                            }
                        />
                        <Bar
                            dataKey="male"
                            stackId="gender"
                            fill="var(--color-male)"
                            radius={[0, 0, 0, 0]}
                            maxBarSize={24}
                            isAnimationActive={false}
                        />
                        <Bar
                            dataKey="female"
                            stackId="gender"
                            fill="var(--color-female)"
                            radius={[0, 0, 0, 0]}
                            maxBarSize={24}
                            isAnimationActive={false}
                        />
                        <Bar
                            dataKey="unspecified"
                            stackId="gender"
                            fill="var(--color-unspecified)"
                            radius={[0, 6, 6, 0]}
                            maxBarSize={24}
                            isAnimationActive={false}
                        />
                    </BarChart>
                </ChartContainer>
            ) : (
                <Empty note="Belum ada data kewarganegaraan." />
            )}

            <div className="analytics-stat-grid">
                {rows.map((row) => (
                    <div
                        key={row.label}
                        className="rounded-xl border bg-muted/20 p-3"
                    >
                        <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-medium break-words text-muted-foreground">
                                {row.label}
                            </span>
                            <Badge
                                variant="secondary"
                                className="px-1.5 py-0 text-xs tabular-nums"
                            >
                                {count(row.percent ?? 0)}%
                            </Badge>
                        </div>
                        <p className="mt-1 text-xl font-bold tabular-nums">
                            {count(row.value)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                            <span title="Laki-laki">
                                L: {count(row.male ?? 0)}
                            </span>
                            <span title="Perempuan">
                                P: {count(row.female ?? 0)}
                            </span>
                            {(row.unspecified ?? 0) > 0 && (
                                <span title="Tidak disebutkan">
                                    ?: {count(row.unspecified ?? 0)}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function BroadcastVisual({
    rows,
    tall = false,
}: {
    rows: ReportRow[];
    tall?: boolean;
}) {
    const recorded =
        rows.find((r) => r.label === 'Notifikasi tercatat')?.value ??
        rows[1]?.value ??
        0;
    const read =
        rows.find((r) => r.label === 'Notifikasi dibaca')?.value ??
        rows[2]?.value ??
        0;
    const unread = Math.max(0, recorded - read);
    const rate = notificationReadRate(read, recorded);
    const displayRate = rate !== null ? Math.round(rate) : 0;

    const donutData =
        recorded > 0
            ? [
                  {
                      label: 'Dibaca',
                      value: read,
                      fill: 'var(--chart-1)',
                  },
                  {
                      label: 'Belum dibaca',
                      value: unread,
                      fill: 'var(--muted)',
                  },
              ]
            : [
                  {
                      label: 'Belum ada notifikasi',
                      value: 1,
                      fill: 'var(--muted)',
                  },
              ];

    const chartConfig = {
        Dibaca: { label: 'Notifikasi Dibaca', color: 'var(--chart-1)' },
        'Belum dibaca': { label: 'Belum Dibaca', color: 'var(--muted)' },
    } satisfies ChartConfig;

    const icons = [Radio, Bell, MailCheck];
    const donutSize = tall ? 'h-48 w-48' : 'h-40 w-40';

    return (
        <div className="analytics-donut-layout">
            <div
                className={`relative mx-auto shrink-0 transition-all duration-200 ${donutSize}`}
            >
                <ChartContainer
                    config={chartConfig}
                    className="aspect-square h-full w-full"
                >
                    <PieChart accessibilityLayer>
                        <ChartTooltip
                            content={<ChartTooltipContent nameKey="label" />}
                        />
                        <Pie
                            data={donutData}
                            dataKey="value"
                            nameKey="label"
                            innerRadius="68%"
                            outerRadius="92%"
                            startAngle={90}
                            endAngle={-270}
                            stroke="none"
                            isAnimationActive={false}
                        >
                            {donutData.map((entry) => (
                                <Cell key={entry.label} fill={entry.fill} />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <strong className="text-2xl font-bold tabular-nums">
                        {rate !== null ? `${displayRate}%` : '—'}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                        rasio baca
                    </span>
                </div>
            </div>

            <div className="w-full flex-1 space-y-2.5">
                {rows.map((row, idx) => {
                    const maxVal = Math.max(1, ...rows.map((r) => r.value));
                    const Icon = icons[idx % icons.length];
                    const barColor =
                        idx === 0
                            ? 'var(--chart-2)'
                            : idx === 1
                              ? 'var(--chart-3)'
                              : 'var(--chart-1)';

                    return (
                        <div
                            key={row.label}
                            className="rounded-xl border bg-muted/20 p-3"
                        >
                            <div className="flex items-center justify-between gap-2 text-sm">
                                <span className="flex items-center gap-2 font-medium">
                                    <Icon className="size-4 text-primary" />
                                    {row.label}
                                </span>
                                <strong className="text-base font-bold tabular-nums">
                                    {count(row.value)}
                                </strong>
                            </div>
                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        background: barColor,
                                        width: `${Math.max(4, (row.value / maxVal) * 100)}%`,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CategoriesVisual({
    widget,
    rows,
    tall = false,
}: {
    widget: ReportWidget;
    rows: ReportRow[];
    tall?: boolean;
}) {
    const totalPubs = widget.rows.reduce((n, r) => n + r.value, 0);
    const hasLifetime = widget.rows.some((r) => r.lifetime_views !== undefined);
    const totalViews = widget.rows.reduce(
        (n, r) => n + (r.lifetime_views ?? 0),
        0,
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
                        {count(totalPubs)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        publikasi dalam periode
                    </span>
                </div>
                {hasLifetime && (
                    <Badge variant="outline" className="text-xs tabular-nums">
                        Total {count(totalViews)} tayangan terakumulasi
                    </Badge>
                )}
            </div>

            <TimeChart
                rows={widget.trend?.length ? widget.trend : widget.rows}
                metric="Publikasi"
                height={tall ? 220 : 165}
                area={false}
            />

            {rows.length > 0 && (
                <div className="analytics-stat-grid border-t pt-4">
                    {rows.map((r, i) => {
                        const maxVal = Math.max(
                            1,
                            ...widget.rows.map((x) => x.value),
                        );
                        const color = CHART_PALETTE[i % CHART_PALETTE.length];

                        return (
                            <div
                                key={r.label}
                                className="rounded-xl border bg-muted/20 p-3"
                            >
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="flex items-center gap-1.5 font-medium break-words">
                                        <span
                                            className="size-2 shrink-0 rounded-full"
                                            style={{ background: color }}
                                        />
                                        {r.label}
                                    </span>
                                    <strong className="text-sm tabular-nums">
                                        {count(r.value)}
                                    </strong>
                                </div>
                                <div className="my-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            background: color,
                                            width: `${(r.value / maxVal) * 100}%`,
                                        }}
                                    />
                                </div>
                                {r.lifetime_views !== undefined && (
                                    <p className="text-xs text-muted-foreground tabular-nums">
                                        {count(r.lifetime_views)} tayangan
                                        terakumulasi
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function Heatmap({
    widget,
    compact = false,
}: {
    widget: ReportWidget;
    compact?: boolean;
}) {
    const days = [
        'Senin',
        'Selasa',
        'Rabu',
        'Kamis',
        'Jumat',
        'Sabtu',
        'Minggu',
    ];
    const cells = widget.heatmap ?? [];
    const max = Math.max(1, ...cells.map((c) => c.value));

    if (!cells.length) {
        return <Empty note="Peta aktivitas belum tersedia." />;
    }

    return (
        <div className={compact ? 'space-y-1' : 'space-y-2.5 border-t pt-4'}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                    {compact
                        ? 'Warga unik · Hari / jam'
                        : 'Warga unik per hari & jam (00:00–23:00)'}
                </span>
                <div
                    className={compact ? 'hidden' : 'flex items-center gap-1.5'}
                >
                    <span>Sepi</span>
                    {[0.12, 0.35, 0.6, 0.85, 1].map((op) => (
                        <span
                            key={op}
                            className="size-3 rounded-xs bg-primary"
                            style={{ opacity: op }}
                        />
                    ))}
                    <span>Ramai ({count(max)})</span>
                </div>
            </div>
            <div className="overflow-x-auto">
                <div
                    className={
                        compact
                            ? 'grid gap-px text-[10px]'
                            : 'grid min-w-[620px] gap-1 text-[10px]'
                    }
                    style={{
                        gridTemplateColumns: compact
                            ? '28px repeat(24,minmax(0,1fr))'
                            : '64px repeat(24,minmax(0,1fr))',
                    }}
                >
                    <span className="text-muted-foreground">
                        {compact ? '' : 'Hari / jam'}
                    </span>
                    {Array.from({ length: 24 }, (_, h) => (
                        <span
                            key={h}
                            className="text-center text-muted-foreground tabular-nums"
                        >
                            {!compact || h % 6 === 0
                                ? String(h).padStart(2, '0')
                                : ''}
                        </span>
                    ))}
                    {days.map((day, index) => (
                        <div key={day} className="contents">
                            <span className="self-center font-medium text-muted-foreground">
                                {compact ? day.slice(0, 3) : day}
                            </span>
                            {Array.from({ length: 24 }, (_, hour) => {
                                const value = cells.find(
                                    (c) =>
                                        c.day === index + 1 && c.hour === hour,
                                )?.value;

                                return (
                                    <Tooltip key={hour}>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className={`${compact ? 'h-2.5' : 'h-6'} rounded-sm transition-opacity focus-visible:outline-2 focus-visible:outline-ring`}
                                                aria-label={`${day} ${hour}:00: ${value === undefined ? 'Tidak tersedia' : count(value) + ' warga'}`}
                                                style={{
                                                    background:
                                                        value === undefined
                                                            ? 'var(--muted)'
                                                            : `color-mix(in srgb, var(--chart-1) ${value === 0 ? 6 : 20 + (value / max) * 80}%, var(--background))`,
                                                }}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {day} ·{' '}
                                            {String(hour).padStart(2, '0')}:00 ·{' '}
                                            {value === undefined
                                                ? 'Tidak tersedia'
                                                : `${count(value)} warga unik`}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function Meta({
    widget,
    tall = false,
}: {
    widget: ReportWidget;
    tall?: boolean;
}) {
    const accounts = widget.accounts ?? [];

    if (!accounts.length) {
        return <Empty note="Belum ada akun media sosial yang terhubung." />;
    }

    return (
        <div className="analytics-heatmaps gap-4">
            {accounts.map((account) => {
                const brand = BRAND_COLORS[account.platform] ?? {
                    color: 'var(--chart-1)',
                    label: account.platform,
                    metricLabel: 'Metrik Harian',
                };
                const statusInfo = STATUS_LABELS[account.status] ?? {
                    text: account.status,
                    variant: 'outline' as const,
                };
                const groups = groupMetrics(account.rows);

                return (
                    <div
                        key={account.platform}
                        className="min-w-0 space-y-3 rounded-xl border bg-muted/15 p-4"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
                            <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span
                                        className="size-2.5 rounded-full"
                                        style={{
                                            backgroundColor: brand.color,
                                        }}
                                    />
                                    <h4 className="text-sm font-semibold capitalize">
                                        {brand.label}
                                    </h4>
                                    <span className="text-xs text-muted-foreground">
                                        · {account.account ?? 'Belum dipilih'}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Sinkron terakhir:{' '}
                                    {account.last_sync
                                        ? new Date(
                                              account.last_sync,
                                          ).toLocaleString('id-ID')
                                        : 'Belum pernah'}
                                </p>
                            </div>
                            <Badge
                                variant={statusInfo.variant}
                                className="text-xs"
                            >
                                {statusInfo.text}
                            </Badge>
                        </div>

                        {groups.length > 0 ? (
                            <div className="space-y-4">
                                {groups.map((group) => {
                                    const latest =
                                        group.rows[group.rows.length - 1];
                                    const peak = Math.max(
                                        ...group.rows.map((r) => r.value),
                                    );

                                    return (
                                        <div
                                            key={group.metric}
                                            className="space-y-2.5"
                                        >
                                            <div className="flex flex-wrap gap-2.5">
                                                <div className="rounded-lg border bg-card px-3 py-2">
                                                    <span className="text-xs text-muted-foreground">
                                                        {group.metric} Terbaru (
                                                        {latest.label})
                                                    </span>
                                                    <p
                                                        className="text-xl font-bold tabular-nums"
                                                        style={{
                                                            color: brand.color,
                                                        }}
                                                    >
                                                        {count(latest.value)}
                                                    </p>
                                                </div>
                                                <div className="rounded-lg border bg-card px-3 py-2">
                                                    <span className="text-xs text-muted-foreground">
                                                        Puncak Periode
                                                    </span>
                                                    <p className="text-xl font-bold tabular-nums">
                                                        {count(peak)}
                                                    </p>
                                                </div>
                                            </div>
                                            <TimeChart
                                                rows={group.rows}
                                                metric={group.metric}
                                                color={brand.color}
                                                height={tall ? 210 : 165}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed bg-card/50 px-3.5 py-4 text-xs text-muted-foreground">
                                {account.note ||
                                    'Belum ada data metrik tersimpan dalam periode ini.'}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/** Fixed dashboard surface. Expanded reports below keep every original row. */
function ResponsiveWidget({
    widget,
    size,
}: {
    widget: ReportWidget;
    size: WidgetSize;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ width: 300, height: 170 });
    useLayoutEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const observer = new ResizeObserver(([entry]) =>
            setBox({
                width: entry.contentRect.width,
                height: entry.contentRect.height,
            }),
        );
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} className="h-full min-h-0 min-w-0">
            <BoundedWidget widget={widget} size={size} box={box} />
        </div>
    );
}

function BoundedWidget({
    widget,
    box,
}: {
    widget: ReportWidget;
    size: WidgetSize;
    box: { width: number; height: number };
}) {
    const tall = box.height > 300;
    const wide = box.width >= 560;
    const split = wide;
    const scope = ['age', 'citizenship', 'ethnicity'].includes(widget.id)
        ? 'Profil warga saat ini'
        : 'Periode terpilih';
    const rows = widget.rows;
    const total = rows.reduce((n, r) => n + r.value, 0);
    const plotHeight = Math.max(95, box.height - 46);
    const chart = {
        value: { label: 'Jumlah', color: 'var(--chart-1)' },
    } satisfies ChartConfig;
    const ordered =
        widget.id === 'ethnicity'
            ? [...rows].sort((a, b) => b.value - a.value)
            : rows;
    const shown = ordered.slice(
        0,
        Math.max(3, Math.floor((plotHeight - 30) / 32)),
    );

    if (widget.id === 'overview') {
        return (
            <div
                className="bounded-kpis grid h-full content-start gap-x-3 gap-y-2"
                style={{
                    gridTemplateColumns: `repeat(${wide ? 4 : 2},minmax(0,1fr))`,
                }}
            >
                {rows.map((r, i) => (
                    <div key={r.label} className="min-h-0 min-w-0">
                        <p
                            className="truncate text-[11px] text-muted-foreground"
                            title={r.label}
                        >
                            {[
                                'Warga terdaftar',
                                'Pendaftaran baru',
                                'Warga aktif',
                                'Profil lengkap',
                            ][i] ?? r.label}
                        </p>
                        <p className="text-xl font-semibold tabular-nums">
                            {count(r.value)}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                            {i === 0
                                ? 'Profil saat ini'
                                : i === 3
                                  ? `${rows[0]?.value ? Math.round((r.value / rows[0].value) * 100) : 0}% · Lahir & kewarganegaraan`
                                  : 'Dalam periode terpilih'}
                        </p>
                    </div>
                ))}
            </div>
        );
    }

    if (widget.id === 'engagement') {
        return (
            <div className="flex h-full items-start gap-3 py-3">
                <Share2 className="size-5 shrink-0 text-muted-foreground" />
                <div>
                    <p className="text-sm font-medium">Segera hadir</p>
                    <p className="text-xs text-muted-foreground">
                        Interaksi dan komentar warga belum tersedia.
                    </p>
                </div>
            </div>
        );
    }

    if (widget.id === 'age') {
        const config = Object.fromEntries(
            rows.map((r, i) => [
                r.label,
                {
                    label: r.label,
                    color: CHART_PALETTE[i % CHART_PALETTE.length],
                },
            ]),
        ) satisfies ChartConfig;

        return (
            <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">
                    {scope} · {count(total)} warga
                </p>
                <div
                    className={`flex ${tall && !wide ? 'flex-col' : ''} items-center gap-2`}
                >
                    <ChartContainer
                        config={config}
                        className="aspect-square shrink-0"
                        style={{
                            width: tall
                                ? Math.min(200, box.width * (wide ? 0.4 : 0.7))
                                : Math.min(120, box.width * 0.4),
                            height: tall
                                ? Math.min(200, box.width * (wide ? 0.4 : 0.7))
                                : Math.min(120, box.width * 0.4),
                        }}
                    >
                        <PieChart accessibilityLayer>
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent nameKey="label" />
                                }
                            />
                            <Pie
                                data={
                                    total
                                        ? rows
                                        : [
                                              {
                                                  label: 'Belum ada data',
                                                  value: 1,
                                              },
                                          ]
                                }
                                dataKey="value"
                                nameKey="label"
                                innerRadius="62%"
                                outerRadius="88%"
                                isAnimationActive={false}
                                stroke="none"
                            >
                                {(total ? rows : [{ label: 'empty' }]).map(
                                    (r, i) => (
                                        <Cell
                                            key={r.label}
                                            fill={
                                                total
                                                    ? CHART_PALETTE[
                                                          i %
                                                              CHART_PALETTE.length
                                                      ]
                                                    : 'var(--muted)'
                                            }
                                        />
                                    ),
                                )}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                    <div
                        className="grid min-w-0 flex-1 gap-1 self-stretch text-[11px]"
                        style={{
                            gridTemplateColumns:
                                wide && !tall
                                    ? 'repeat(2,minmax(0,1fr))'
                                    : undefined,
                        }}
                    >
                        {rows.slice(0, tall || wide ? 8 : 4).map((r, i) => (
                            <div
                                key={r.label}
                                className="flex min-w-0 items-center gap-1"
                            >
                                <span
                                    className="size-2 shrink-0 rounded-sm"
                                    style={{
                                        background:
                                            CHART_PALETTE[
                                                i % CHART_PALETTE.length
                                            ],
                                    }}
                                />
                                <span className="truncate">{r.label}</span>
                                <span className="ml-auto shrink-0 tabular-nums">
                                    {count(r.value)} ·{' '}
                                    {total
                                        ? Math.round((r.value / total) * 100)
                                        : 0}
                                    %
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                {!tall && !wide && rows.length > 4 && (
                    <p className="text-[11px] text-muted-foreground">
                        +{rows.length - 4} kelompok di Detail · Semua kelompok
                        dalam donut
                    </p>
                )}
            </div>
        );
    }

    if (widget.id === 'citizenship' || widget.id === 'ethnicity') {
        const stacked = widget.id === 'citizenship';
        const config = stacked
            ? {
                  male: { label: 'Laki-laki', color: 'var(--chart-1)' },
                  female: { label: 'Perempuan', color: 'var(--chart-2)' },
                  unspecified: {
                      label: 'Tidak disebutkan',
                      color: 'var(--chart-3)',
                  },
              }
            : chart;

        return (
            <div>
                <p className="truncate text-[11px] text-muted-foreground">
                    {scope} · {count(total)} warga
                </p>
                <ChartContainer
                    config={config}
                    className="aspect-auto w-full"
                    style={{ height: plotHeight }}
                >
                    <BarChart
                        data={stacked ? rows : shown}
                        layout="vertical"
                        accessibilityLayer
                        margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                    >
                        <CartesianGrid
                            horizontal={false}
                            strokeDasharray="3 3"
                        />
                        <XAxis
                            type="number"
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10 }}
                        />
                        <YAxis
                            type="category"
                            dataKey="label"
                            width={75}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) =>
                                String(v).length > 12
                                    ? `${String(v).slice(0, 11)}…`
                                    : v
                            }
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        {(stacked
                            ? ['male', 'female', 'unspecified']
                            : ['value']
                        ).map((key, i) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                stackId="total"
                                fill={CHART_PALETTE[i]}
                                maxBarSize={20}
                                isAnimationActive={false}
                            />
                        ))}
                    </BarChart>
                </ChartContainer>
                <p className="truncate text-[10px] text-muted-foreground">
                    {stacked
                        ? 'Laki-laki · Perempuan · Tidak disebutkan — arahkan ke batang'
                        : rows.length > shown.length
                          ? `${shown.length} dari ${rows.length} kelompok · Selengkapnya di Detail`
                          : 'Jumlah warga per kelompok'}
                </p>
            </div>
        );
    }

    if (widget.id === 'categories' || widget.id === 'activity') {
        const activity = widget.id === 'activity';

        return (
            <div className="space-y-1">
                <p className="truncate text-[11px] text-muted-foreground">
                    {activity
                        ? 'Warga unik per hari · Tidak dijumlahkan antarhari'
                        : `${count(total)} publikasi · Periode terpilih`}
                </p>
                <div
                    className="grid min-w-0 gap-3"
                    style={{
                        gridTemplateColumns: split
                            ? 'minmax(0,1fr) minmax(0,1fr)'
                            : undefined,
                    }}
                >
                    <TimeChart
                        rows={activity ? rows : (widget.trend ?? [])}
                        area={activity}
                        metric={activity ? 'Warga unik' : 'Publikasi'}
                        height={Math.max(
                            90,
                            split
                                ? box.height - 35
                                : tall
                                  ? activity
                                      ? box.height - 235
                                      : box.height - 190
                                  : box.height - 52,
                        )}
                    />
                    {(tall || split) && activity ? (
                        <Heatmap widget={widget} compact />
                    ) : tall || split ? (
                        <div className="space-y-2">
                            {shown.slice(0, 5).map((r) => (
                                <div
                                    className="flex items-center justify-between gap-2 text-xs"
                                    key={r.label}
                                >
                                    <span className="truncate">{r.label}</span>
                                    <span className="tabular-nums">
                                        {count(r.value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="truncate text-[10px] text-muted-foreground">
                            {activity
                                ? 'Peta hari/jam tersedia di ukuran Tall atau Detail'
                                : rows.some(
                                        (r) => r.lifetime_views !== undefined,
                                    )
                                  ? `${count(rows.reduce((n, r) => n + (r.lifetime_views ?? 0), 0))} tayangan sepanjang waktu · Bukan pembaca unik`
                                  : 'Kategori lengkap tersedia di Detail'}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (widget.id === 'broadcast') {
        const rate = notificationReadRate(
            rows[2]?.value ?? 0,
            rows[1]?.value ?? 0,
        );

        return (
            <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground">
                    Status baca saat ini · Siaran dalam periode
                </p>
                <div
                    className="grid gap-3"
                    style={{
                        gridTemplateColumns: wide
                            ? 'minmax(0,1fr) minmax(0,1fr)'
                            : undefined,
                    }}
                >
                    <div className="grid grid-cols-3 gap-2">
                        {rows.map((r, i) => (
                            <div key={r.label}>
                                <p className="text-lg font-semibold tabular-nums">
                                    {count(r.value)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                    {['Siaran', 'Tercatat', 'Dibaca'][i]}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div>
                        <p className="text-xs">
                            {count(rows[2]?.value ?? 0)} dari{' '}
                            {count(rows[1]?.value ?? 0)} notifikasi dibaca
                        </p>
                        <div className="mt-2 h-2 rounded bg-muted">
                            <div
                                className="h-full rounded bg-primary"
                                style={{ width: `${rate ?? 0}%` }}
                            />
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                    Tercatat bukan bukti pengiriman perangkat.
                </p>
            </div>
        );
    }

    if (widget.id === 'meta') {
        return (
            <div
                className="grid h-full min-h-0 gap-2"
                style={{
                    gridTemplateColumns: wide
                        ? `repeat(${Math.max(1, widget.accounts?.length ?? 1)},minmax(0,1fr))`
                        : undefined,
                    gridTemplateRows: wide
                        ? 'minmax(0,1fr)'
                        : `repeat(${Math.max(1, widget.accounts?.length ?? 1)},minmax(0,1fr))`,
                }}
            >
                {widget.accounts?.map((a) => {
                    const group = groupMetrics(a.rows)[0];
                    const shareHeight = wide
                        ? box.height
                        : (box.height -
                              8 * ((widget.accounts?.length ?? 1) - 1)) /
                          Math.max(1, widget.accounts?.length ?? 1);
                    const miniature = shareHeight < 120;
                    const chartHeight = Math.max(
                        24,
                        shareHeight - (miniature ? 34 : 52),
                    );

                    return (
                        <div key={a.platform} className="min-h-0 min-w-0">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="truncate font-medium capitalize">
                                    {a.platform} ·{' '}
                                    {a.account ?? 'Belum dipilih'}
                                </span>
                                <span className="shrink-0 text-muted-foreground">
                                    {STATUS_LABELS[a.status]?.text ?? a.status}
                                </span>
                            </div>
                            {group ? (
                                <>
                                    <p className="truncate text-[10px] text-muted-foreground">
                                        {group.metric} ·{' '}
                                        {a.last_sync
                                            ? `Sinkron ${new Date(a.last_sync).toLocaleDateString('id-ID')}`
                                            : 'Belum sinkron'}
                                    </p>
                                    {!miniature && (
                                        <p className="text-[11px] font-medium">
                                            {count(
                                                group.rows.at(-1)?.value ?? 0,
                                            )}{' '}
                                            · Pengamatan terakhir
                                        </p>
                                    )}
                                    <TimeChart
                                        rows={group.rows}
                                        metric={group.metric}
                                        height={chartHeight}
                                        miniature={miniature}
                                        color={BRAND_COLORS[a.platform]?.color}
                                    />
                                </>
                            ) : (
                                <p
                                    className="truncate text-[11px] text-muted-foreground"
                                    title={a.note}
                                >
                                    {a.note || 'Belum ada data.'}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    return <p className="text-xs text-muted-foreground">{widget.note}</p>;
}

export default function AnalyticsWidgetRenderer({
    widget,
    size,
    expanded = false,
    bounded = false,
}: {
    widget: ReportWidget;
    size: WidgetSize;
    expanded?: boolean;
    bounded?: boolean;
}) {
    if (bounded && !expanded) {
        return (
            <TooltipProvider>
                <ResponsiveWidget widget={widget} size={size} />
            </TooltipProvider>
        );
    }

    const tall = expanded || size === 'medium' || size === 'large';
    const limit = expanded ? widget.rows.length : tall ? 10 : 6;
    const rows = widget.rows.slice(0, limit);

    return (
        <TooltipProvider>
            <div className="analytics-tile min-w-0 space-y-4">
                {widget.id === 'overview' ? (
                    <OverviewKpiGrid rows={widget.rows} />
                ) : widget.id === 'categories' ? (
                    <CategoriesVisual widget={widget} rows={rows} tall={tall} />
                ) : widget.id === 'age' ? (
                    <AgeDonut rows={widget.rows} tall={tall} />
                ) : widget.id === 'citizenship' ? (
                    <Citizenship rows={widget.rows} tall={tall} />
                ) : widget.id === 'ethnicity' ? (
                    <HorizontalDistribution rows={rows} tall={tall} />
                ) : widget.id === 'activity' ? (
                    <div className="space-y-4">
                        <TimeChart
                            rows={widget.rows}
                            metric="Warga unik"
                            height={tall ? 230 : 175}
                        />
                        {size !== 'small' || expanded ? (
                            <Heatmap widget={widget} />
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Peta hari/jam tersedia saat kartu diperbesar
                                atau di Lihat detail.
                            </p>
                        )}
                    </div>
                ) : widget.id === 'broadcast' ? (
                    <BroadcastVisual rows={widget.rows} tall={tall} />
                ) : widget.id === 'meta' ? (
                    <Meta widget={widget} tall={tall} />
                ) : widget.id === 'engagement' ? (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed bg-muted/15 p-4">
                        <div className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-card">
                                <Share2 className="size-5 text-muted-foreground" />
                            </span>
                            <div>
                                <CardDescription className="font-medium text-foreground">
                                    Engagement Analytics
                                </CardDescription>
                                <p className="text-xs text-muted-foreground">
                                    Integrasi interaksi & komentar warga
                                </p>
                            </div>
                        </div>
                        <Badge variant="secondary">Segera hadir</Badge>
                    </div>
                ) : (
                    <Empty note={`${widget.title} · ${widget.note}`} />
                )}
                {['categories', 'ethnicity'].includes(widget.id) &&
                    widget.rows.length > limit && (
                        <p className="text-xs text-muted-foreground">
                            +{widget.rows.length - limit} kelompok lainnya
                            tersedia di Lihat detail atau mode Tinggi.
                        </p>
                    )}
            </div>
        </TooltipProvider>
    );
}
