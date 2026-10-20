import {
    Activity,
    ArrowUpRight,
    ChartNoAxesCombined,
    CircleHelp,
    Clock3,
    Eye,
    EyeOff,
    GripVertical,
    Share2,
    Users,
} from 'lucide-react';
import { useId } from 'react';
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
import ChartGrid from '@/components/analytics/chart-grid';
import type { GridCell } from '@/components/analytics/chart-grid';
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

export type WidgetHeight = 'sm' | 'md' | 'lg';
export type WidgetSpan = 1 | 2;

export type ReportRow = {
    label: string;
    value: number;
    percent?: number;
    male?: number;
    female?: number;
    unspecified?: number;
    lifetime_views?: number;
};

export type ReportWidget = {
    id: string;
    title: string;
    note: string;
    span?: WidgetSpan;
    height?: WidgetHeight;
    grid?: GridCell;
    rows: ReportRow[];
    trend?: ReportRow[];
    heatmap?: { day: number; hour: number; value: number }[];
    accounts?: {
        platform: string;
        account: string | null;
        status: string;
        last_sync: string | null;
        rows: ReportRow[];
        note: string;
    }[];
};

const number = (n: number) => n.toLocaleString('id-ID');

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

const HEIGHT_CLASS: Record<WidgetHeight, string> = {
    sm: 'h-[var(--analytics-chart-height,9rem)]',
    md: 'h-[var(--analytics-chart-height,13rem)]',
    lg: 'h-[var(--analytics-chart-height,18rem)]',
};

const DONUT_SIZE_CLASS: Record<WidgetHeight, string> = {
    sm: 'h-[var(--analytics-donut-size,9rem)] w-[var(--analytics-donut-size,9rem)]',
    md: 'h-[var(--analytics-donut-size,12rem)] w-[var(--analytics-donut-size,12rem)]',
    lg: 'h-[var(--analytics-donut-size,15rem)] w-[var(--analytics-donut-size,15rem)]',
};

const BRAND_COLORS: Record<
    string,
    { color: string; label: string; metricLabel: string; badgeClass: string }
> = {
    facebook: {
        color: 'var(--platform-facebook)',
        label: 'Facebook',
        metricLabel: 'Kunjungan Halaman Harian',
        badgeClass:
            'border-[var(--platform-facebook)]/30 bg-[var(--platform-facebook)]/10 text-[var(--platform-facebook)]',
    },
    instagram: {
        color: 'var(--platform-instagram)',
        label: 'Instagram',
        metricLabel: 'Jangkauan Harian (Reach)',
        badgeClass:
            'border-[var(--platform-instagram)]/30 bg-[var(--platform-instagram)]/10 text-[var(--platform-instagram)]',
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

function EmptyChartState({
    message = 'Belum ada data dalam periode ini',
}: {
    message?: string;
}) {
    return (
        <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/15 px-4 py-6 text-center text-muted-foreground">
            <ChartNoAxesCombined className="size-6 shrink-0 opacity-40" />
            <p className="text-xs font-medium">{message}</p>
        </div>
    );
}

function TrendPlot({
    rows,
    area = false,
    color = 'var(--chart-1)',
    seriesLabel = 'Jumlah',
    height = 'md',
}: {
    rows: ReportRow[];
    area?: boolean;
    color?: string;
    seriesLabel?: string;
    height?: WidgetHeight;
}) {
    const id = useId().replace(/:/g, '');

    if (!rows.some((r) => r.value > 0)) {
        return <EmptyChartState />;
    }

    const chartConfig = {
        value: {
            label: seriesLabel,
            color,
        },
    } satisfies ChartConfig;

    const formattedRows = rows.map((r) => ({
        ...r,
        shortLabel: /^\d{4}-\d{2}-\d{2}/.test(r.label)
            ? r.label.slice(5, 10)
            : r.label,
    }));

    return (
        <div
            role="img"
            aria-label={rows.map((r) => `${r.label}: ${r.value}`).join(', ')}
        >
            <ChartContainer
                config={chartConfig}
                className={`${HEIGHT_CLASS[height]} analytics-plot aspect-auto w-full`}
            >
                {area ? (
                    <AreaChart
                        data={formattedRows}
                        margin={{ top: 12, right: 12, bottom: 4, left: -10 }}
                    >
                        <defs>
                            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor="var(--color-value)"
                                    stopOpacity={0.38}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--color-value)"
                                    stopOpacity={0.02}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="shortLabel"
                            tickLine={false}
                            axisLine={false}
                            minTickGap={20}
                            tickMargin={8}
                        />
                        <YAxis
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
                            name="value"
                            dataKey="value"
                            type="monotone"
                            stroke="var(--color-value)"
                            strokeWidth={2.5}
                            fill={`url(#${id})`}
                            activeDot={{ r: 4 }}
                        />
                    </AreaChart>
                ) : (
                    <BarChart
                        data={formattedRows}
                        margin={{ top: 12, right: 12, bottom: 4, left: -10 }}
                    >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="shortLabel"
                            tickLine={false}
                            axisLine={false}
                            minTickGap={20}
                            tickMargin={8}
                        />
                        <YAxis
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
                            name="value"
                            dataKey="value"
                            fill="var(--color-value)"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={44}
                        />
                    </BarChart>
                )}
            </ChartContainer>
        </div>
    );
}

function HorizontalBarDistribution({
    rows,
    height = 'md',
}: {
    rows: ReportRow[];
    height?: WidgetHeight;
}) {
    const total = rows.reduce((n, r) => n + r.value, 0);

    if (!rows.length || total === 0) {
        return <EmptyChartState />;
    }

    const chartConfig = {
        value: {
            label: 'Warga',
            color: 'var(--chart-1)',
        },
    } satisfies ChartConfig;

    const sorted = [...rows].sort((a, b) => b.value - a.value);
    const baseHeight = height === 'sm' ? 130 : height === 'lg' ? 250 : 170;

    return (
        <div className="space-y-4">
            <ChartContainer
                config={chartConfig}
                className="analytics-plot aspect-auto w-full"
                style={{
                    height: `max(var(--analytics-chart-height, ${baseHeight}px), ${sorted.length * 36}px)`,
                }}
            >
                <BarChart
                    data={sorted}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                        type="number"
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        dataKey="label"
                        type="category"
                        width={110}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                        dataKey="value"
                        name="value"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={24}
                    >
                        {sorted.map((entry, index) => (
                            <Cell
                                key={entry.label}
                                fill={
                                    CHART_PALETTE[index % CHART_PALETTE.length]
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

                    return (
                        <div
                            key={row.label}
                            className="inline-flex items-center gap-2 rounded-lg border bg-muted/25 px-2.5 py-1 text-xs"
                        >
                            <span
                                className="size-2 shrink-0 rounded-full"
                                style={{
                                    background:
                                        CHART_PALETTE[i % CHART_PALETTE.length],
                                }}
                            />
                            <span className="font-medium">{row.label}</span>
                            <span className="font-semibold tabular-nums">
                                {number(row.value)}
                            </span>
                            <span className="text-muted-foreground">
                                ({pct}%)
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CitizenshipChart({
    rows,
    height = 'md',
}: {
    rows: ReportRow[];
    height?: WidgetHeight;
}) {
    const total = rows.reduce((sum, r) => sum + r.value, 0);

    const chartConfig = {
        male: {
            label: 'Laki-laki',
            color: 'var(--chart-1)',
        },
        female: {
            label: 'Perempuan',
            color: 'var(--chart-2)',
        },
        unspecified: {
            label: 'Belum / tidak disebutkan',
            color: 'var(--chart-3)',
        },
    } satisfies ChartConfig;

    return (
        <div className="space-y-4">
            {total > 0 ? (
                <ChartContainer
                    config={chartConfig}
                    className={`${HEIGHT_CLASS[height]} analytics-plot aspect-auto w-full`}
                >
                    <BarChart
                        data={rows}
                        layout="vertical"
                        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
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
                            dataKey="label"
                            type="category"
                            width={130}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12 }}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar
                            dataKey="male"
                            stackId="gender"
                            fill="var(--color-male)"
                            radius={[0, 0, 0, 0]}
                            maxBarSize={24}
                        />
                        <Bar
                            dataKey="female"
                            stackId="gender"
                            fill="var(--color-female)"
                            radius={[0, 0, 0, 0]}
                            maxBarSize={24}
                        />
                        <Bar
                            dataKey="unspecified"
                            stackId="gender"
                            fill="var(--color-unspecified)"
                            radius={[0, 6, 6, 0]}
                            maxBarSize={24}
                        />
                    </BarChart>
                </ChartContainer>
            ) : (
                <EmptyChartState />
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
                                {number(row.percent ?? 0)}%
                            </Badge>
                        </div>
                        <p className="mt-1 text-xl font-bold tabular-nums">
                            {number(row.value)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                            <span title="Laki-laki">
                                L: {number(row.male ?? 0)}
                            </span>
                            <span title="Perempuan">
                                P: {number(row.female ?? 0)}
                            </span>
                            {(row.unspecified ?? 0) > 0 && (
                                <span title="Belum disebutkan">
                                    ?: {number(row.unspecified ?? 0)}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AgeDonutChart({
    rows,
    height = 'md',
}: {
    rows: ReportRow[];
    height?: WidgetHeight;
}) {
    const total = rows.reduce((n, r) => n + r.value, 0);
    const hasData = total > 0;

    const chartConfig = Object.fromEntries(
        rows.map((r, i) => [
            r.label,
            {
                label: r.label,
                color: CHART_PALETTE[i % CHART_PALETTE.length],
            },
        ]),
    ) satisfies ChartConfig;

    return (
        <div className="analytics-donut-layout">
            <div
                className={`relative mx-auto shrink-0 transition-all duration-200 ${DONUT_SIZE_CLASS[height]}`}
            >
                <ChartContainer
                    config={chartConfig}
                    className="aspect-square h-full w-full"
                >
                    <PieChart>
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
                        >
                            {(hasData
                                ? rows
                                : [{ label: 'empty', value: 1 }]
                            ).map((r, i) => (
                                <Cell
                                    key={r.label}
                                    fill={
                                        hasData
                                            ? CHART_PALETTE[
                                                  i % CHART_PALETTE.length
                                              ]
                                            : 'var(--muted)'
                                    }
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <strong className="text-2xl font-bold tabular-nums">
                        {number(total)}
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
                    const color = CHART_PALETTE[i % CHART_PALETTE.length];

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
                                    {number(row.value)}
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

function BroadcastVisual({
    rows,
    height = 'md',
}: {
    rows: ReportRow[];
    height?: WidgetHeight;
}) {
    const notificationsLogged = rows[1]?.value ?? 0;
    const notificationsRead = rows[2]?.value ?? 0;
    const unread = Math.max(0, notificationsLogged - notificationsRead);
    const readRate =
        notificationsLogged > 0
            ? Math.round((notificationsRead / notificationsLogged) * 100)
            : 0;

    const donutData =
        notificationsLogged > 0
            ? [
                  {
                      label: 'Dibaca',
                      value: notificationsRead,
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

    return (
        <div className="analytics-donut-layout">
            <div
                className={`relative mx-auto shrink-0 transition-all duration-200 ${DONUT_SIZE_CLASS[height]}`}
            >
                <ChartContainer
                    config={chartConfig}
                    className="aspect-square h-full w-full"
                >
                    <PieChart>
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
                        >
                            {donutData.map((entry) => (
                                <Cell key={entry.label} fill={entry.fill} />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <strong className="text-2xl font-bold tabular-nums">
                        {readRate}%
                    </strong>
                    <span className="text-xs text-muted-foreground">
                        rasio baca
                    </span>
                </div>
            </div>

            <div className="w-full flex-1 space-y-2.5">
                {rows.map((row, idx) => {
                    const maxVal = Math.max(1, ...rows.map((r) => r.value));
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
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{row.label}</span>
                                <strong className="text-base font-bold tabular-nums">
                                    {number(row.value)}
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

function MetaAccountsVisual({
    accounts,
    height = 'md',
}: {
    accounts: NonNullable<ReportWidget['accounts']>;
    height?: WidgetHeight;
}) {
    return (
        <div className="grid gap-4">
            {accounts.map((account) => {
                const brand = BRAND_COLORS[account.platform] ?? {
                    color: 'var(--chart-1)',
                    label: account.platform,
                    metricLabel: 'Metrik Harian',
                    badgeClass: '',
                };
                const statusInfo = STATUS_LABELS[account.status] ?? {
                    text: account.status,
                    variant: 'outline' as const,
                };
                const latestPoint =
                    account.rows.length > 0
                        ? account.rows[account.rows.length - 1]
                        : null;
                const peakValue =
                    account.rows.length > 0
                        ? Math.max(...account.rows.map((r) => r.value))
                        : null;

                return (
                    <div
                        key={account.platform}
                        className="rounded-xl border bg-muted/15 p-4"
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
                                    <h3 className="text-sm font-semibold">
                                        {brand.label}
                                    </h3>
                                    <span className="text-xs text-muted-foreground">
                                        · {account.account ?? 'Belum dipilih'}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {brand.metricLabel} · Sinkron terakhir:{' '}
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

                        {account.rows.length > 0 ? (
                            <div className="mt-3 space-y-3">
                                <div className="flex flex-wrap gap-3">
                                    {latestPoint && (
                                        <div className="rounded-lg border bg-card px-3 py-2">
                                            <span className="text-xs text-muted-foreground">
                                                Terbaru (
                                                {
                                                    latestPoint.label.split(
                                                        ' · ',
                                                    )[0]
                                                }
                                                )
                                            </span>
                                            <p
                                                className="text-xl font-bold tabular-nums"
                                                style={{ color: brand.color }}
                                            >
                                                {number(latestPoint.value)}
                                            </p>
                                        </div>
                                    )}
                                    {peakValue !== null && (
                                        <div className="rounded-lg border bg-card px-3 py-2">
                                            <span className="text-xs text-muted-foreground">
                                                Puncak Harian (Periode)
                                            </span>
                                            <p className="text-xl font-bold tabular-nums">
                                                {number(peakValue)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <TrendPlot
                                    rows={account.rows}
                                    area
                                    color={brand.color}
                                    seriesLabel={brand.metricLabel}
                                    height={height}
                                />
                            </div>
                        ) : (
                            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed bg-card/50 px-3.5 py-3 text-xs text-muted-foreground">
                                <span>{account.note}</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export function WidgetBody({
    widget,
    height,
}: {
    widget: ReportWidget;
    height: WidgetHeight;
}) {
    if (widget.id === 'citizenship') {
        return <CitizenshipChart rows={widget.rows} height={height} />;
    }

    if (widget.id === 'categories') {
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2.5">
                        <span className="text-3xl font-bold tracking-tight tabular-nums">
                            {number(
                                widget.rows.reduce((n, r) => n + r.value, 0),
                            )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            publikasi dalam periode
                        </span>
                    </div>
                    {widget.rows.some(
                        (r) => r.lifetime_views !== undefined,
                    ) && (
                        <Badge
                            variant="outline"
                            className="text-xs tabular-nums"
                        >
                            Total{' '}
                            {number(
                                widget.rows.reduce(
                                    (n, r) => n + (r.lifetime_views ?? 0),
                                    0,
                                ),
                            )}{' '}
                            tayangan seumur hidup
                        </Badge>
                    )}
                </div>

                <TrendPlot
                    rows={widget.trend?.length ? widget.trend : widget.rows}
                    seriesLabel="Publikasi"
                    height={height}
                />

                {widget.rows.length > 0 && (
                    <div className="analytics-stat-grid border-t pt-4">
                        {widget.rows.map((r, i) => {
                            const maxVal = Math.max(
                                1,
                                ...widget.rows.map((x) => x.value),
                            );
                            const color =
                                CHART_PALETTE[i % CHART_PALETTE.length];

                            return (
                                <div
                                    key={r.label}
                                    className="rounded-xl border bg-muted/20 p-3"
                                >
                                    <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="flex items-center gap-1.5 font-medium break-words">
                                            <span
                                                className="size-2 shrink-0 rounded-full"
                                                style={{
                                                    background: color,
                                                }}
                                            />
                                            {r.label}
                                        </span>
                                        <strong className="text-sm tabular-nums">
                                            {number(r.value)}
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
                                            {number(r.lifetime_views)} tayangan
                                            seumur hidup
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

    if (widget.id === 'age') {
        return <AgeDonutChart rows={widget.rows} height={height} />;
    }

    if (widget.id === 'broadcast') {
        return <BroadcastVisual rows={widget.rows} height={height} />;
    }

    if (widget.heatmap) {
        return (
            <div className="space-y-4">
                <TrendPlot
                    rows={widget.rows}
                    area
                    seriesLabel="Warga Aktif Unik"
                    height={height}
                />
                {widget.heatmap.some((cell) => cell.value > 0) && (
                    <div className="space-y-2 border-t pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                                Peta jam aktif warga unik (Senin–Minggu,
                                00:00–23:00)
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span>Sepi</span>
                                {[0.12, 0.35, 0.6, 0.85, 1].map((op) => (
                                    <span
                                        key={op}
                                        className="size-3 rounded-xs bg-primary"
                                        style={{ opacity: op }}
                                    />
                                ))}
                                <span>Ramai</span>
                            </div>
                        </div>
                        <div className="analytics-heatmaps">
                            {[0, 12].map((startHour) => (
                                <table
                                    key={startHour}
                                    className="w-full table-fixed border-separate border-spacing-1 text-xs"
                                >
                                    <thead>
                                        <tr className="text-muted-foreground">
                                            <th className="w-10 text-left font-medium">
                                                Hari
                                            </th>
                                            {Array.from(
                                                { length: 12 },
                                                (_, index) => index + startHour,
                                            ).map((h) => (
                                                <th
                                                    key={h}
                                                    className="font-normal tabular-nums"
                                                >
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            'Sen',
                                            'Sel',
                                            'Rab',
                                            'Kam',
                                            'Jum',
                                            'Sab',
                                            'Min',
                                        ].map((label, i) => (
                                            <tr key={label}>
                                                <th className="text-left font-medium text-muted-foreground">
                                                    {label}
                                                </th>
                                                {widget
                                                    .heatmap!.filter(
                                                        (c) =>
                                                            c.day === i + 1 &&
                                                            c.hour >=
                                                                startHour &&
                                                            c.hour <
                                                                startHour + 12,
                                                    )
                                                    .map((cell) => (
                                                        <td
                                                            key={cell.hour}
                                                            title={`${label} ${cell.hour}:00 — ${cell.value} warga`}
                                                            className="h-6 rounded-sm bg-primary text-center transition-opacity"
                                                            style={{
                                                                opacity:
                                                                    cell.value
                                                                        ? 0.3 +
                                                                          (0.7 *
                                                                              cell.value) /
                                                                              Math.max(
                                                                                  1,
                                                                                  ...widget.heatmap!.map(
                                                                                      (
                                                                                          c,
                                                                                      ) =>
                                                                                          c.value,
                                                                                  ),
                                                                              )
                                                                        : 0.08,
                                                            }}
                                                        >
                                                            <span className="sr-only">
                                                                {cell.value}
                                                            </span>
                                                        </td>
                                                    ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (widget.id === 'engagement') {
        return (
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
        );
    }

    if (widget.accounts) {
        return (
            <MetaAccountsVisual accounts={widget.accounts} height={height} />
        );
    }

    return <HorizontalBarDistribution rows={widget.rows} height={height} />;
}

function WidgetCard({
    widget,
    editable = false,
    height = 'md',
    sharedWithModerator = false,
    onToggleModerator,
}: {
    widget: ReportWidget;
    editable?: boolean;
    height?: WidgetHeight;
    sharedWithModerator?: boolean;
    onToggleModerator?: (id: string) => void;
}) {
    return (
        <Card className="analytics-widget flex h-full min-w-0 flex-col gap-0 py-0 shadow-xs">
            <CardHeader
                className={`analytics-drag-handle flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3 sm:px-5 ${
                    editable
                        ? 'cursor-grab touch-none select-none active:cursor-grabbing'
                        : ''
                }`}
            >
                <div className="flex min-w-0 items-center gap-2">
                    {editable && (
                        <span
                            className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs font-medium text-muted-foreground shadow-2xs"
                            title="Tahan & geser untuk mengubah urutan"
                        >
                            <GripVertical className="size-3.5 text-primary" />
                            Geser
                        </span>
                    )}
                    <CardTitle className="text-base font-semibold break-words">
                        {widget.title}
                    </CardTitle>
                </div>

                <div
                    className="flex flex-wrap items-center gap-1.5"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {editable && (
                        <>
                            {/* Moderator Visibility Toggle */}
                            <button
                                type="button"
                                onClick={() => onToggleModerator?.(widget.id)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                                    sharedWithModerator
                                        ? 'border-success-border bg-success-bg text-success-text'
                                        : 'bg-card text-muted-foreground hover:text-foreground'
                                }`}
                                title="Tampilkan di Dasbor Moderator"
                            >
                                {sharedWithModerator ? (
                                    <>
                                        <Eye className="size-3.5" />
                                        Moderator
                                    </>
                                ) : (
                                    <>
                                        <EyeOff className="size-3.5" />
                                        Admin Saja
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                title={widget.note}
                                aria-label={widget.note}
                                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            >
                                <CircleHelp className="size-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs leading-relaxed">
                            {widget.note}
                        </TooltipContent>
                    </Tooltip>
                </div>
            </CardHeader>

            <CardContent className="analytics-widget-body min-h-0 flex-1 p-5">
                <WidgetBody widget={widget} height={height} />
            </CardContent>
        </Card>
    );
}

export default function ReportWidgets({
    widgets,
    editable = false,
    moderatorWidgets = [],
    sizes = {},
    grid,
    onGridChange,
    onToggleModerator,
}: {
    widgets: ReportWidget[];
    editable?: boolean;
    moderatorWidgets?: string[];
    sizes?: Record<string, { span: WidgetSpan; height: WidgetHeight }>;
    grid?: Record<string, GridCell>;
    onGridChange?: (cells: Record<string, GridCell>) => void;
    onToggleModerator?: (id: string) => void;
}) {
    const overview = widgets.find((w) => w.id === 'overview');
    const chartWidgets = widgets.filter((w) => w.id !== 'overview');

    const totalVillagers = overview?.rows[0]?.value ?? 0;
    const icons = [Users, ArrowUpRight, Activity, Clock3];
    const kpiColors = [
        'text-primary bg-primary/10 border-primary/20',
        'text-teal-500 bg-teal-500/10 border-teal-500/20',
        'text-warning-500 bg-warning-500/10 border-warning-500/20',
        'text-violet-500 bg-violet-500/10 border-violet-500/20',
    ];

    return (
        <TooltipProvider>
            <div className="space-y-6">
                {overview && (
                    <div className="space-y-2.5">
                        {editable && (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs">
                                <span className="font-semibold text-foreground">
                                    {overview.title} (Kartu KPI Atas)
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onToggleModerator?.('overview')
                                    }
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                                        moderatorWidgets.includes('overview')
                                            ? 'border-success-border bg-success-bg text-success-text'
                                            : 'bg-card text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {moderatorWidgets.includes('overview') ? (
                                        <>
                                            <Eye className="size-3.5" />
                                            Tampil di Moderator
                                        </>
                                    ) : (
                                        <>
                                            <EyeOff className="size-3.5" />
                                            Admin Saja
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {overview.rows.map((row, i) => {
                                const Icon = icons[i % icons.length];
                                const showRatio =
                                    (i === 2 || i === 3) && totalVillagers > 0;
                                const ratio = showRatio
                                    ? Math.round(
                                          (row.value / totalVillagers) * 100,
                                      )
                                    : null;

                                return (
                                    <Card
                                        key={row.label}
                                        className="gap-0 overflow-hidden py-0 shadow-xs"
                                    >
                                        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/20 px-5 py-3.5">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                {row.label}
                                            </CardTitle>
                                            <span
                                                className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg border ${kpiColors[i % kpiColors.length]}`}
                                            >
                                                <Icon className="size-4" />
                                            </span>
                                        </CardHeader>
                                        <CardContent className="px-5 py-4">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <p className="text-3xl font-bold tracking-tight tabular-nums">
                                                    {number(row.value)}
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
                                            <p className="mt-1.5 text-xs text-muted-foreground">
                                                {i === 0 || i === 3
                                                    ? 'Profil warga saat ini'
                                                    : 'Dalam periode terpilih'}
                                            </p>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}

                <ChartGrid
                    widgets={chartWidgets}
                    cells={grid}
                    editable={editable}
                    onChange={onGridChange}
                >
                    {(widget) => (
                        <WidgetCard
                            widget={widget}
                            editable={editable}
                            height={
                                sizes[widget.id]?.height ??
                                widget.height ??
                                'md'
                            }
                            sharedWithModerator={moderatorWidgets.includes(
                                widget.id,
                            )}
                            onToggleModerator={onToggleModerator}
                        />
                    )}
                </ChartGrid>
            </div>
        </TooltipProvider>
    );
}
