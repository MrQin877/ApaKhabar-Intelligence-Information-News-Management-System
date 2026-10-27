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
    'var(--chart-4)',
    'var(--chart-5)',
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

    if (!rows.length) {
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
            className="analytics-plot aspect-auto w-full min-w-0 shrink-0"
            initialDimension={{ width: 320, height }}
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
                            tick={{ fontSize: 12 }}
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
            <div
                className={
                    compact
                        ? 'hidden'
                        : 'flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'
                }
            >
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
                            ? 'grid gap-px text-xs'
                            : 'grid min-w-[620px] gap-1 text-xs'
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

function SummaryChip({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-primary/5 px-2 py-1 text-[11px] leading-tight text-foreground">
            {children}
        </span>
    );
}

/** Keep long distributions inside the card; more rows fit as its height grows. */
function InlineBreakdown({
    rows,
    total,
    limit,
    progress = true,
}: {
    rows: ReportRow[];
    total: number;
    limit: number;
    progress?: boolean;
}) {
    const [page, setPage] = useState(0);
    const pages = Math.max(1, Math.ceil(rows.length / limit));
    const current = Math.min(page, pages - 1);
    const shown = rows.slice(current * limit, (current + 1) * limit);

    return (
        <div className="min-w-0 space-y-2">
            <div className="grid gap-2">
                {shown.map((r, i) => {
                    const percent = total ? (r.value / total) * 100 : 0;

                    return (
                        <div key={r.label} className="min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px]">
                                <span
                                    className="size-2 shrink-0 rounded-sm"
                                    style={{
                                        background:
                                            CHART_PALETTE[
                                                (current * limit + i) %
                                                    CHART_PALETTE.length
                                            ],
                                    }}
                                />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="min-w-0 truncate text-left"
                                        >
                                            {r.label}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {r.label}: {count(r.value)} ·{' '}
                                        {percent.toFixed(1)}%
                                    </TooltipContent>
                                </Tooltip>
                                <span className="ml-auto shrink-0 tabular-nums">
                                    {count(r.value)} · {percent.toFixed(1)}%
                                </span>
                            </div>
                            {progress && (
                                <div className="h-1.5 rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${percent}%`,
                                            background:
                                                CHART_PALETTE[
                                                    (current * limit + i) %
                                                        CHART_PALETTE.length
                                                ],
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {pages > 1 && (
                <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                    <button
                        type="button"
                        aria-label="Kelompok sebelumnya"
                        disabled={!current}
                        onClick={() => setPage(current - 1)}
                        className="rounded border px-2 py-0.5 disabled:opacity-40"
                    >
                        ←
                    </button>
                    <span>
                        {current * limit + 1}–
                        {Math.min((current + 1) * limit, rows.length)} dari{' '}
                        {rows.length}
                    </span>
                    <button
                        type="button"
                        aria-label="Kelompok berikutnya"
                        disabled={current === pages - 1}
                        onClick={() => setPage(current + 1)}
                        className="rounded border px-2 py-0.5 disabled:opacity-40"
                    >
                        →
                    </button>
                </div>
            )}
        </div>
    );
}

function RegistrationTrend({
    widget,
    tall,
}: {
    widget: ReportWidget;
    tall: boolean;
}) {
    const trend = widget.registration_trend ?? [];

    if (!trend.length) {
        return null;
    }

    return (
        <div
            className="flex min-h-0 flex-1 flex-col gap-1"
            data-registration-trend
        >
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="mr-auto">
                    Pendaftaran harian (akun) · X: tanggal
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-sm bg-chart-1" />
                    Periode ini
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-sm bg-chart-2" />
                    Periode lalu (hari sejajar)
                </span>
            </div>
            <ChartContainer
                config={{
                    current: { label: 'Periode ini', color: 'var(--chart-1)' },
                    previous: {
                        label: 'Periode lalu (hari sejajar)',
                        color: 'var(--chart-2)',
                    },
                }}
                className="aspect-auto min-h-0 w-full flex-1"
                initialDimension={{ width: 320, height: 60 }}
            >
                <AreaChart
                    data={trend}
                    accessibilityLayer
                    aria-label="Pendaftaran harian dibanding periode sebelumnya"
                    margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
                >
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="label"
                        hide={!tall}
                        tick={{ fontSize: 12 }}
                        minTickGap={35}
                        tickFormatter={(value) => value.slice(5)}
                    />
                    <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 12 }}
                        width={36}
                        tickLine={false}
                        axisLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                        dataKey="previous"
                        type="monotone"
                        stroke="var(--color-previous)"
                        fill="var(--color-previous)"
                        fillOpacity={0.04}
                        strokeDasharray="4 3"
                        isAnimationActive={false}
                    />
                    <Area
                        dataKey="current"
                        type="monotone"
                        stroke="var(--color-current)"
                        fill="var(--color-current)"
                        fillOpacity={0.14}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ChartContainer>
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
    const tall = box.height > 300,
        wide = box.width >= 560;
    const rows = widget.rows,
        total = rows.reduce((sum, r) => sum + r.value, 0);
    const percent = (value: number, denominator = total) =>
        denominator ? ((value / denominator) * 100).toFixed(1) : '0.0';
    const [rankPage, setRankPage] = useState(0);

    if (widget.id === 'overview') {
        const icons = [Users, ArrowUpRight, Activity, Clock3];

        return (
            <div className="flex h-full min-h-0 flex-col gap-2">
                <div
                    className="grid shrink-0 gap-2"
                    style={{
                        gridTemplateColumns: `repeat(${wide ? 4 : 2},minmax(0,1fr))`,
                    }}
                >
                    {rows.map((r, i) => {
                        const Icon = icons[i % 4];

                        return (
                            <div
                                key={r.label}
                                className="min-w-0 rounded-xl border border-neutral-200 p-2 dark:border-neutral-800"
                            >
                                <div className="flex items-center justify-between gap-1">
                                    <span className="truncate text-[11px] text-muted-foreground">
                                        {[
                                            'Warga terdaftar',
                                            'Pendaftaran baru',
                                            'Warga aktif',
                                            'Profil lengkap',
                                        ][i] ?? r.label}
                                    </span>
                                    <span className="rounded bg-primary/10 p-1 text-primary">
                                        <Icon className="size-3" />
                                    </span>
                                </div>
                                <p className="text-2xl font-semibold tabular-nums">
                                    {count(r.value)}
                                </p>
                                <p className="truncate text-[10px] text-muted-foreground">
                                    {i === 0
                                        ? 'Profil saat ini'
                                        : i === 1
                                          ? widget.registration_previous ===
                                            undefined
                                              ? 'Dalam periode terpilih'
                                              : `${r.value - widget.registration_previous >= 0 ? '+' : ''}${count(r.value - widget.registration_previous)} vs periode sebelumnya`
                                          : `${percent(r.value, rows[0]?.value ?? 0)}% dari warga`}
                                </p>
                                {tall && (
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        {i === 3
                                            ? 'Tanggal lahir dan kewarganegaraan terisi.'
                                            : i === 2
                                              ? 'Warga unik yang membuka feed atau berita.'
                                              : r.label}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
                {(wide || tall) && (
                    <RegistrationTrend widget={widget} tall={tall} />
                )}
            </div>
        );
    }

    if (widget.id === 'age') {
        const known = rows.filter((r) => r.label !== 'Belum mengisi'),
            top = [...known].sort((a, b) => b.value - a.value)[0];
        const donut = tall
            ? Math.min(wide ? 220 : 180, box.width * 0.65)
            : Math.min(110, box.width * 0.34);
        const config = Object.fromEntries(
            rows.map((r, i) => [
                r.label,
                {
                    label: r.label,
                    color: CHART_PALETTE[i % CHART_PALETTE.length],
                },
            ]),
        );

        return (
            <div className="flex h-full flex-col gap-2">
                <SummaryChip>
                    {top?.value
                        ? `Kelompok terbesar: ${top.label} · ${percent(top.value)}%`
                        : 'Belum ada data usia'}
                </SummaryChip>
                <div
                    className="flex min-h-0 flex-1 items-center gap-3"
                    style={{ flexDirection: tall && !wide ? 'column' : 'row' }}
                >
                    <div
                        className="relative shrink-0"
                        style={{ width: donut, height: donut }}
                    >
                        <ChartContainer
                            config={config}
                            className="aspect-square h-full w-full"
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
                                    innerRadius="68%"
                                    outerRadius="96%"
                                    stroke="none"
                                    isAnimationActive={false}
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
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <strong
                                className={
                                    tall
                                        ? 'text-2xl tabular-nums'
                                        : 'text-sm tabular-nums'
                                }
                            >
                                {count(total)}
                            </strong>
                            <span className="text-[10px] text-muted-foreground">
                                Total warga
                            </span>
                        </div>
                    </div>
                    <div
                        className="grid w-full min-w-0 flex-1 gap-x-3 gap-y-1"
                        style={{
                            gridTemplateColumns:
                                wide || tall
                                    ? 'repeat(2,minmax(0,1fr))'
                                    : 'minmax(0,1fr)',
                        }}
                    >
                        {rows.map((r, i) => (
                            <div key={r.label} className="min-w-0">
                                <div className="flex items-center gap-1 text-[10px]">
                                    <span
                                        className="size-1.5 shrink-0 rounded-sm"
                                        style={{
                                            background:
                                                CHART_PALETTE[
                                                    i % CHART_PALETTE.length
                                                ],
                                        }}
                                    />
                                    <span className="truncate" title={r.label}>
                                        {r.label}
                                    </span>
                                    <span className="ml-auto shrink-0 tabular-nums">
                                        {count(r.value)} · {percent(r.value)}%
                                    </span>
                                </div>
                                {tall && (
                                    <div className="mt-1 h-1 rounded bg-muted">
                                        <div
                                            className="h-full rounded"
                                            style={{
                                                background:
                                                    CHART_PALETTE[
                                                        i % CHART_PALETTE.length
                                                    ],
                                                width: `${percent(r.value)}%`,
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (widget.id === 'citizenship') {
        const male = rows.reduce((n, r) => n + (r.male ?? 0), 0),
            female = rows.reduce((n, r) => n + (r.female ?? 0), 0),
            unknown = total - male - female;
        const wni = rows.find((r) => r.label === 'WNI')?.value ?? 0;
        const config = {
            male: { label: 'Laki-laki', color: 'var(--chart-1)' },
            female: { label: 'Perempuan', color: 'var(--chart-2)' },
            unspecified: { label: 'Tidak disebutkan', color: 'var(--chart-3)' },
        };

        return (
            <div className="flex h-full flex-col gap-1">
                <div className="flex flex-wrap gap-1">
                    <SummaryChip>
                        {percent(male)}% L · {percent(female)}% P ·{' '}
                        {percent(unknown)}% belum diisi
                    </SummaryChip>
                    <SummaryChip>WNI {percent(wni)}%</SummaryChip>
                </div>
                <div
                    className="grid min-h-0 flex-1 gap-3"
                    style={{
                        gridTemplateColumns: wide
                            ? 'minmax(0,1.2fr) minmax(0,1fr)'
                            : undefined,
                    }}
                >
                    <ChartContainer
                        config={config}
                        className="aspect-auto w-full"
                        style={{
                            height: Math.max(
                                70,
                                wide
                                    ? box.height - 40
                                    : tall
                                      ? 220
                                      : box.height - 58,
                            ),
                        }}
                    >
                        <BarChart
                            data={rows}
                            layout="vertical"
                            accessibilityLayer
                            margin={{ left: 0, right: 5, top: 4, bottom: 0 }}
                        >
                            <CartesianGrid
                                horizontal={false}
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                type="number"
                                height={36}
                                label={{
                                    value: 'Akun (jumlah)',
                                    position: 'insideBottom',
                                    offset: 0,
                                    fontSize: 10,
                                }}
                                allowDecimals={false}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis
                                type="category"
                                dataKey="label"
                                width={70}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12 }}
                                tickFormatter={(v) =>
                                    v === 'Dua Kewarganegaraan'
                                        ? 'Ganda'
                                        : v === 'Belum mengisi'
                                          ? 'Belum diisi'
                                          : v
                                }
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            {['male', 'female', 'unspecified'].map((key, i) => (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    stackId="gender"
                                    fill={CHART_PALETTE[i]}
                                    maxBarSize={26}
                                    isAnimationActive={false}
                                />
                            ))}
                        </BarChart>
                    </ChartContainer>
                    {(wide || tall) && (
                        <InlineBreakdown rows={rows} total={total} limit={4} />
                    )}
                </div>
            </div>
        );
    }

    if (widget.id === 'ethnicity') {
        const filled =
                total -
                (rows.find((r) => r.label === 'Belum mengisi')?.value ?? 0),
            sorted = [...rows].sort((a, b) => b.value - a.value);
        const limit = tall
            ? Math.max(4, Math.floor((box.height - 75) / 34))
            : 3;

        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <SummaryChip>{percent(filled)}% terisi</SummaryChip>
                    <span className="text-[11px] text-muted-foreground">
                        {count(total)} warga
                    </span>
                </div>
                <InlineBreakdown rows={sorted} total={total} limit={limit} />
            </div>
        );
    }

    if (widget.id === 'categories') {
        const limit = wide
            ? Math.max(3, Math.floor((box.height - 110) / 36))
            : tall
              ? 6
              : 2;

        return (
            <div className="flex h-full flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <p className="whitespace-nowrap">
                        <strong className="text-xl font-semibold tabular-nums">
                            {count(total)}
                        </strong>{' '}
                        <span className="text-[11px] text-muted-foreground">
                            publikasi
                        </span>
                    </p>
                    {rows.some((r) => r.lifetime_views !== undefined) && (
                        <SummaryChip>
                            {count(
                                rows.reduce(
                                    (n, r) => n + (r.lifetime_views ?? 0),
                                    0,
                                ),
                            )}{' '}
                            tayangan kumulatif (kali)
                        </SummaryChip>
                    )}
                </div>
                <div
                    className="grid min-h-0 flex-1 gap-2"
                    style={{
                        gridTemplateColumns: wide
                            ? 'minmax(0,1fr) minmax(0,1fr)'
                            : undefined,
                    }}
                >
                    <TimeChart
                        rows={widget.trend ?? []}
                        area
                        metric="Publikasi"
                        height={
                            wide
                                ? box.height - 42
                                : tall
                                  ? Math.max(120, box.height - 280)
                                  : Math.max(40, box.height - 140)
                        }
                        miniature={!tall && !wide}
                    />
                    <InlineBreakdown
                        rows={rows}
                        total={total}
                        limit={limit}
                        progress={tall || wide}
                    />
                </div>
            </div>
        );
    }

    if (widget.id === 'broadcast') {
        const recorded = rows[1]?.value ?? 0,
            read = rows[2]?.value ?? 0,
            rate = notificationReadRate(read, recorded);

        return (
            <div className="flex h-full flex-col gap-3">
                <p className="text-[11px] text-muted-foreground">
                    Siaran dalam periode · Status baca saat ini
                </p>
                <div
                    className="grid flex-1 content-start gap-2"
                    style={{
                        gridTemplateColumns: wide
                            ? 'repeat(3,minmax(0,1fr))'
                            : undefined,
                    }}
                >
                    {rows.map((r, i) => (
                        <div key={r.label} className="flex items-center gap-2">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary">
                                {i + 1}
                            </span>
                            <span className="text-xs">
                                {
                                    [
                                        'Siaran dikirim',
                                        'Notifikasi tercatat',
                                        'Telah dibaca',
                                    ][i]
                                }
                            </span>
                            <strong className="ml-auto text-sm tabular-nums">
                                {count(r.value)}
                            </strong>
                        </div>
                    ))}
                </div>
                <div className="rounded-lg bg-primary/5 px-2 py-1.5 text-[11px]">
                    {rate === null
                        ? 'Belum ada notifikasi tercatat'
                        : `${rate.toFixed(1)}% dibaca · ${count(read)} dari ${count(recorded)} notifikasi`}
                </div>
                {tall && (
                    <p className="text-xs text-muted-foreground">
                        Satu siaran dapat menghasilkan banyak notifikasi.
                        Tercatat bukan bukti perangkat menerima notifikasi;
                        waktu baca rata-rata belum tersedia.
                    </p>
                )}
            </div>
        );
    }

    if (widget.id === 'activity') {
        const cells = widget.heatmap ?? [],
            max = Math.max(0, ...cells.map((c) => c.value)),
            peaks = cells.filter((c) => c.value === max && max > 0),
            peak = peaks[0];
        const day = [
            '',
            'Senin',
            'Selasa',
            'Rabu',
            'Kamis',
            'Jumat',
            'Sabtu',
            'Minggu',
        ];

        return (
            <div className="flex h-full flex-col gap-2">
                <SummaryChip>
                    {peak
                        ? `Puncak teramati: ${day[peak.day]} ${String(peak.hour).padStart(2, '0')}:00 · ${count(max)} warga${peaks.length > 1 ? ` (+${peaks.length - 1} waktu setara)` : ''}`
                        : 'Belum ada aktivitas teramati'}
                </SummaryChip>
                <Heatmap widget={widget} compact />
                {tall && (
                    <>
                        <p className="text-[11px] text-muted-foreground">
                            Warga unik per hari · Tidak dijumlahkan antarhari
                        </p>
                        <TimeChart
                            rows={rows}
                            metric="Warga unik"
                            height={Math.max(100, box.height - 205)}
                        />
                    </>
                )}
            </div>
        );
    }

    if (widget.id === 'meta') {
        const accounts = widget.accounts ?? [],
            countAccounts = Math.max(1, accounts.length);

        return (
            <div
                className="grid h-full min-h-0 gap-2"
                style={{
                    gridTemplateColumns: wide
                        ? `repeat(${countAccounts},minmax(0,1fr))`
                        : undefined,
                    gridTemplateRows: wide
                        ? 'minmax(0,1fr)'
                        : `repeat(${countAccounts},minmax(0,1fr))`,
                }}
            >
                {accounts.map((a) => {
                    const groups = groupMetrics(a.rows),
                        group =
                            groups[
                                Math.min(
                                    rankPage,
                                    Math.max(0, groups.length - 1),
                                )
                            ],
                        all = group?.rows ?? [],
                        points = all.slice(-7),
                        latest = all.at(-1),
                        previous = all.at(-2);
                    const consecutive =
                        latest &&
                        previous &&
                        Date.parse(latest.label) -
                            Date.parse(previous.label) ===
                            86400000;
                    const delta =
                        consecutive && previous.value > 0
                            ? ((latest.value - previous.value) /
                                  previous.value) *
                              100
                            : null;
                    const height = wide
                            ? box.height
                            : (box.height - 8 * (countAccounts - 1)) /
                              countAccounts,
                        mini = height < 125;
                    const brand = BRAND_COLORS[a.platform];

                    return (
                        <div
                            key={a.platform}
                            className="flex min-h-0 min-w-0 flex-col gap-0.5"
                            style={
                                {
                                    '--social-color': brand?.color,
                                } as React.CSSProperties
                            }
                        >
                            <div className="flex items-center gap-1 text-[11px]">
                                <span
                                    className="size-2 rounded-sm"
                                    style={{ background: brand?.color }}
                                />
                                <strong className="capitalize">
                                    {a.platform}
                                </strong>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="ml-auto truncate text-[10px] text-muted-foreground"
                                        >
                                            {STATUS_LABELS[a.status]?.text ??
                                                a.status}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {a.note} · Sinkron:{' '}
                                        {a.last_sync
                                            ? new Date(
                                                  a.last_sync,
                                              ).toLocaleString('id-ID')
                                            : 'Belum pernah'}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            {group ? (
                                <>
                                    <div className="flex min-w-0 items-center gap-1 text-[10px]">
                                        <span className="truncate">
                                            {group.metric} (
                                            {a.platform === 'facebook'
                                                ? 'kali/hari'
                                                : 'akun/hari'}
                                            )
                                        </span>
                                        <strong className="ml-auto text-sm tabular-nums">
                                            {count(latest?.value ?? 0)}
                                        </strong>
                                        {delta !== null && (
                                            <span className="shrink-0 text-[10px]">
                                                {delta > 0 ? '+' : ''}
                                                {delta.toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                    <TimeChart
                                        rows={points}
                                        metric={group.metric}
                                        height={Math.max(
                                            24,
                                            height - (mini ? 44 : 78),
                                        )}
                                        miniature={mini}
                                        color={brand?.color}
                                    />
                                    {!mini && (
                                        <p className="truncate text-[10px] text-muted-foreground">
                                            X: tanggal UTC · {latest?.label} ·{' '}
                                            {delta !== null
                                                ? 'Δ vs hari sebelumnya'
                                                : 'Tanpa pembanding harian'}{' '}
                                            · {a.account}
                                        </p>
                                    )}
                                    {groups.length > 1 && (
                                        <button
                                            type="button"
                                            className="text-[10px] underline"
                                            onClick={() =>
                                                setRankPage(
                                                    (rankPage + 1) %
                                                        groups.length,
                                                )
                                            }
                                        >
                                            Metrik berikutnya
                                        </button>
                                    )}
                                </>
                            ) : (
                                <p className="text-[11px] text-muted-foreground">
                                    {a.note || 'Belum ada pengamatan.'}
                                </p>
                            )}
                        </div>
                    );
                })}
                {!accounts.length && (
                    <p className="text-xs text-muted-foreground">
                        Akun resmi belum dipilih.
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col justify-center gap-2">
            <Share2 className="size-5 text-primary" />
            <p className="text-lg font-semibold">Belum tersedia</p>
            <p className="text-xs text-muted-foreground">
                Skor interaksi dan umpan balik menunggu integrasi modul
                engagement.
            </p>
            <span className="text-[11px] text-muted-foreground">
                Tidak dihitung sebagai nol
            </span>
        </div>
    );
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
                                pada kartu yang diperbesar.
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
                            tersedia saat kartu diperbesar.
                        </p>
                    )}
            </div>
        </TooltipProvider>
    );
}
