import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import GridLayout, {
    useContainerWidth,
    verticalCompactor,
} from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { widgetBudget } from '@/lib/analytics-widget-sizing';
import type { ReportWidget } from './report-widgets';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

export type GridCell = { x: number; y: number; w: number; h: number };

export function defaultGrid(widgets: ReportWidget[]): Record<string, GridCell> {
    let y = 0;
    let x = 0;

    return Object.fromEntries(
        widgets.map((widget) => {
            const w =
                widget.id === 'categories' || widget.id === 'activity' ? 12 : 6;

            if (x + w > 12) {
                x = 0;
                y += 6;
            }

            const cell = { x, y, w, h: 6 };
            x += w;

            if (x === 12) {
                x = 0;
                y += 6;
            }

            return [widget.id, cell];
        }),
    );
}

function GridTile({
    children,
    id,
    onMinimum,
    fixed = true,
}: {
    children: ReactNode;
    id: string;
    onMinimum: (id: string, rows: number) => void;
    fixed?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const body = element.querySelector<HTMLElement>(
            '.analytics-widget-body',
        );
        const content = body?.firstElementChild as HTMLElement | null;
        const header = element.querySelector<HTMLElement>(
            '.analytics-drag-handle',
        );

        if (!body || !content || !header) {
            return;
        }

        let frame = 0;
        const measure = () => {
            const plots = Array.from(
                content.querySelectorAll<HTMLElement>('.analytics-plot'),
            );
            const plotHeight = plots.reduce(
                (sum, plot) => sum + plot.offsetHeight,
                0,
            );
            const padding =
                parseFloat(getComputedStyle(body).paddingTop) +
                parseFloat(getComputedStyle(body).paddingBottom);
            const contentHeight = Math.max(
                content.offsetHeight,
                content.scrollHeight,
            );
            // Reserve the actual summaries, legends, gaps, and header before sizing plots.
            const chrome =
                header.offsetHeight + padding + 4 + contentHeight - plotHeight;
            const minPlot =
                id === 'ethnicity'
                    ? Math.max(
                          180,
                          content.querySelectorAll('.recharts-bar-rectangle')
                              .length *
                              36 +
                              40,
                      )
                    : 180;
            const budget = widgetBudget({
                chrome,
                plotCount: plots.length,
                minPlot,
                height: element.clientHeight,
                fixed,
            });
            onMinimum(id, budget.rows);
            const value = budget.chartHeight + 'px';

            if (
                element.style.getPropertyValue('--analytics-chart-height') !==
                value
            ) {
                element.style.setProperty('--analytics-chart-height', value);
            }
        };
        const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
        };
        const observer = new ResizeObserver(schedule);
        [element, header, body, content].forEach((node) =>
            observer.observe(node),
        );
        const mutation = new MutationObserver(schedule);
        mutation.observe(content, {
            childList: true,
            subtree: true,
            characterData: true,
        });
        schedule();

        return () => {
            observer.disconnect();
            mutation.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [id, onMinimum, fixed]);

    return (
        <div
            ref={ref}
            className={
                fixed ? 'analytics-tile h-full min-h-0' : 'analytics-tile'
            }
        >
            {children}
        </div>
    );
}

export default function ChartGrid({
    widgets,
    cells,
    editable,
    onChange,
    children,
}: {
    widgets: ReportWidget[];
    cells?: Record<string, GridCell>;
    editable: boolean;
    onChange?: (cells: Record<string, GridCell>) => void;
    children: (widget: ReportWidget) => ReactNode;
}) {
    const { width, containerRef, mounted } = useContainerWidth();
    const [minimums, setMinimums] = useState<Record<string, number>>({});
    const onMinimum = useCallback((id: string, rows: number) => {
        setMinimums((current) =>
            current[id] === rows ? current : { ...current, [id]: rows },
        );
    }, []);
    const defaults = defaultGrid(widgets);
    const desktop = width >= 900;
    const layout = widgets.map((widget) => {
        const cell = cells?.[widget.id] ?? widget.grid ?? defaults[widget.id];
        const minW = Math.min(
            12,
            Math.max(4, Math.ceil(420 / ((width + 16) / 12))),
        );
        const minH = Math.max(4, minimums[widget.id] ?? 6);
        const w = Math.max(minW, cell.w);

        return {
            i: widget.id,
            ...cell,
            x: Math.min(cell.x, 12 - w),
            w,
            h: Math.max(minH, cell.h),
            minW,
            minH,
            maxW: 12,
        };
    });
    const commit = (next: Layout) => {
        if (!desktop || !editable) {
            return;
        }

        onChange?.(
            Object.fromEntries(
                next.map(({ i, x, y, w, h }) => [i, { x, y, w, h }]),
            ),
        );
    };

    return (
        <div
            ref={containerRef}
            className={editable && desktop ? 'analytics-grid-edit' : undefined}
        >
            {mounted && desktop ? (
                <GridLayout
                    width={width}
                    layout={layout}
                    gridConfig={{
                        cols: 12,
                        rowHeight: 48,
                        margin: [16, 16],
                        containerPadding: [0, 0],
                    }}
                    compactor={verticalCompactor}
                    dragConfig={{
                        enabled: editable,
                        handle: '.analytics-drag-handle',
                        cancel: 'button,input,select,a',
                    }}
                    resizeConfig={{ enabled: editable, handles: ['se'] }}
                    onDragStop={commit}
                    onResizeStop={commit}
                >
                    {widgets.map((widget) => (
                        <div key={widget.id}>
                            <GridTile id={widget.id} onMinimum={onMinimum}>
                                {children(widget)}
                            </GridTile>
                        </div>
                    ))}
                </GridLayout>
            ) : (
                <div className="grid gap-4">
                    {editable && (
                        <p className="text-sm text-muted-foreground">
                            Gunakan layar lebih lebar untuk mengatur posisi dan
                            ukuran kartu.
                        </p>
                    )}
                    {widgets.map((widget) => (
                        <div key={widget.id}>
                            <GridTile
                                id={widget.id}
                                onMinimum={onMinimum}
                                fixed={false}
                            >
                                {children(widget)}
                            </GridTile>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
