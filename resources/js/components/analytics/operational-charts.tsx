import { CircleHelp } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    XAxis,
    YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from '@/components/ui/chart';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ReportWidget } from './report-widgets';

export const number = (value: number) => value.toLocaleString('id-ID');
export function Empty({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {children}
        </div>
    );
}
export function Metric({
    label,
    value,
    note,
}: {
    label: string;
    value: string | number;
    note: string;
}) {
    return (
        <Card className="gap-2 rounded-xl py-4 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                </CardTitle>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button aria-label={`Definisi ${label}`}>
                                <CircleHelp className="size-4 text-muted-foreground" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                            {note}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </CardHeader>
            <CardContent className="px-4">
                <p className="text-2xl font-semibold tabular-nums">
                    {typeof value === 'number' ? number(value) : value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{note}</p>
            </CardContent>
        </Card>
    );
}
export function TrendChart({
    title,
    rows,
    series,
    bars = false,
    action,
    xLabel = 'Tanggal',
    yLabel = 'Jumlah',
    description,
}: {
    title: string;
    rows: Record<string, string | number>[];
    series: { key: string; label: string; color: string }[];
    bars?: boolean;
    action?: ReactNode;
    xLabel?: string;
    yLabel?: string;
    description?: string;
}) {
    const id = useId().replace(/:/g, '');
    const config = Object.fromEntries(
        series.map((s) => [s.key, { label: s.label, color: s.color }]),
    );

    return (
        <Card className="min-w-0 rounded-xl shadow-none">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">{title}</CardTitle>
                {action}
            </CardHeader>
            <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">{yLabel}</p>
                {!rows.length ? (
                    <Empty>Belum ada data untuk periode ini.</Empty>
                ) : (
                    <ChartContainer
                        config={config}
                        className="aspect-auto h-56 w-full"
                        initialDimension={{ width: 400, height: 224 }}
                    >
                        {bars ? (
                            <BarChart data={rows} accessibilityLayer>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    height={46}
                                    label={{
                                        value: xLabel,
                                        position: 'insideBottom',
                                        offset: 0,
                                        fontSize: 11,
                                    }}
                                    tick={{ fontSize: 12 }}
                                    minTickGap={30}
                                    tickFormatter={(v) =>
                                        /^\d{4}-/.test(v) ? v.slice(5) : v
                                    }
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 12 }}
                                    width={44}
                                />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                />
                                <ChartLegend content={<ChartLegendContent />} />
                                {series.map((s) => (
                                    <Bar
                                        key={s.key}
                                        dataKey={s.key}
                                        fill={s.color}
                                        radius={[3, 3, 0, 0]}
                                        isAnimationActive={false}
                                    />
                                ))}
                            </BarChart>
                        ) : (
                            <AreaChart data={rows} accessibilityLayer>
                                <defs>
                                    {series.map((s) => (
                                        <linearGradient
                                            key={s.key}
                                            id={`${id}-${s.key}`}
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop
                                                offset="0%"
                                                stopColor={s.color}
                                                stopOpacity={0.25}
                                            />
                                            <stop
                                                offset="100%"
                                                stopColor={s.color}
                                                stopOpacity={0.02}
                                            />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    height={46}
                                    label={{
                                        value: xLabel,
                                        position: 'insideBottom',
                                        offset: 0,
                                        fontSize: 11,
                                    }}
                                    tick={{ fontSize: 12 }}
                                    minTickGap={30}
                                    tickFormatter={(v) =>
                                        /^\d{4}-/.test(v) ? v.slice(5) : v
                                    }
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 12 }}
                                    width={44}
                                />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                />
                                <ChartLegend content={<ChartLegendContent />} />
                                {series.map((s) => (
                                    <Area
                                        key={s.key}
                                        dataKey={s.key}
                                        stroke={s.color}
                                        fill={`url(#${id}-${s.key})`}
                                        type="monotone"
                                        isAnimationActive={false}
                                    />
                                ))}
                            </AreaChart>
                        )}
                    </ChartContainer>
                )}
                {description && (
                    <p className="mt-4 text-xs text-muted-foreground">
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
export function BroadcastPanel({
    widget,
    compact = false,
}: {
    widget: ReportWidget;
    compact?: boolean;
}) {
    const recorded = widget.rows[1]?.value ?? 0,
        read = widget.rows[2]?.value ?? 0;

    return (
        <Card className="min-w-0 rounded-xl shadow-none">
            <CardHeader>
                <CardTitle className="text-sm">
                    Kinerja pembacaan siaran
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                    {[
                        ['Siaran', number(widget.rows[0]?.value ?? 0)],
                        ['Notifikasi tercatat', number(recorded)],
                        [
                            'Rasio dibaca',
                            recorded
                                ? `${((read / recorded) * 100).toFixed(1)}%`
                                : '—',
                        ],
                    ].map(([label, value]) => (
                        <div key={label}>
                            <div className="text-xs text-muted-foreground">
                                {label}
                            </div>
                            <div className="text-lg font-semibold tabular-nums">
                                {value}
                            </div>
                        </div>
                    ))}
                </div>
                {!widget.recent?.length ? (
                    <Empty>Belum ada siaran terkirim dalam periode ini.</Empty>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Siaran</TableHead>
                                    <TableHead className="text-right">
                                        Tercatat
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Dibaca
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {widget.recent
                                    .slice(0, compact ? 3 : 30)
                                    .map((b) => (
                                        <TableRow key={b.id}>
                                            <TableCell className="max-w-64 whitespace-normal">
                                                <span className="font-medium">
                                                    {b.title}
                                                </span>
                                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                                    <Badge variant="secondary">
                                                        {b.category}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(
                                                            b.sent_at,
                                                        ).toLocaleDateString(
                                                            'id-ID',
                                                        )}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {number(b.recorded)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {number(b.read)}
                                                <div className="text-xs text-muted-foreground">
                                                    {b.recorded
                                                        ? `${((b.read / b.recorded) * 100).toFixed(1)}%`
                                                        : '—'}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                <p className="text-xs text-muted-foreground">{widget.note}</p>
            </CardContent>
        </Card>
    );
}
