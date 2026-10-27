import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    closestCenter,
    useSensor,
    useSensors,
    useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical,
    Plus,
    X,
    Settings2,
    CircleHelp,
    ArrowUp,
    ArrowDown,
    MoveHorizontal,
    MoveVertical,
} from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    defaultSections,
    footprints,
    moveWidget,
    normalize,
    pack,
    resizePreset,
    ROW_HEIGHT,
    GRID_GAP,
} from '@/lib/analytics-sections';
import type {
    DashboardSection,
    SectionLayout,
    WidgetSize,
} from '@/lib/analytics-sections';
import type { ReportWidget } from './report-widgets';
import AnalyticsWidgetRenderer from './widget-visualizations';

const labels: Record<WidgetSize, string> = {
    small: 'Ringkas · 1 × 1',
    wide: 'Lebar · 2 × 1',
    medium: 'Tinggi · 1 × 2',
    large: 'Besar · 2 × 2',
};
export function useDashboardWidth() {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(1000);
    useLayoutEffect(() => {
        const el = ref.current;

        if (!el) {
            return;
        }

        const measure = () => setWidth(el.getBoundingClientRect().width);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    return { ref, width };
}

function Tile({
    widget,
    size,
    columns,
    section,
    editable,
    style,
    onResize,
    onRemove,
    onMove,
}: {
    widget: ReportWidget;
    size: WidgetSize;
    columns: number;
    section: string;
    editable: boolean;
    style: CSSProperties;
    onResize: (size: WidgetSize) => void;
    onRemove: () => void;
    onMove: (step: number) => void;
}) {
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: widget.id, data: { section }, disabled: !editable });
    const node = useRef<HTMLDivElement | null>(null);
    const gesture = useRef<{
        x: number;
        y: number;
        width: number;
        original: WidgetSize;
        next: WidgetSize;
    } | null>(null);
    const [resizing, setResizing] = useState<WidgetSize | null>(null);
    const [notice, setNotice] = useState('');
    const [resizeColumnWidth, setResizeColumnWidth] = useState(300);
    const [pw, ph] = footprints[resizing ?? size];

    return (
        <div
            ref={(el) => {
                node.current = el;
                setNodeRef(el);
            }}
            data-layout-widget={widget.id}
            className={`section-widget analytics-redesign relative flex min-w-0 flex-col rounded-xl border border-neutral-200 bg-card dark:border-neutral-800 ${isDragging ? 'z-20 opacity-50 ring-2 ring-primary' : ''}`}
            style={{
                ...style,
                transform: CSS.Translate.toString(transform),
                transition,
            }}
        >
            <header className="flex h-11 shrink-0 items-center gap-1 border-b px-3">
                {editable ? (
                    <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 text-left text-sm font-semibold"
                        aria-label={`Pindahkan ${widget.title}`}
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{widget.title}</span>
                    </button>
                ) : (
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {widget.title}
                    </h3>
                )}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-label={`Definisi ${widget.title}`}
                                className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                            >
                                <CircleHelp className="size-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                            {widget.note}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                {editable && (
                    <>
                        <button
                            type="button"
                            className="rounded p-1 text-xs hover:bg-muted"
                            aria-label={`Ubah lebar ${widget.title}`}
                            onClick={() =>
                                onResize(
                                    size === 'wide'
                                        ? 'small'
                                        : size === 'large'
                                          ? 'medium'
                                          : size === 'medium'
                                            ? 'large'
                                            : 'wide',
                                )
                            }
                            disabled={columns === 1}
                        >
                            <MoveHorizontal
                                className="size-4"
                                aria-hidden="true"
                            />
                        </button>
                        <button
                            type="button"
                            className="rounded p-1 text-xs hover:bg-muted"
                            aria-label={`Ubah tinggi ${widget.title}`}
                            onClick={() =>
                                onResize(
                                    size === 'medium'
                                        ? 'small'
                                        : size === 'large'
                                          ? 'wide'
                                          : size === 'wide'
                                            ? 'large'
                                            : 'medium',
                                )
                            }
                        >
                            <MoveVertical
                                className="size-4"
                                aria-hidden="true"
                            />
                        </button>
                    </>
                )}
                {editable && (
                    <button
                        type="button"
                        className="rounded p-1.5 hover:bg-muted"
                        aria-label={`Hapus ${widget.title} dari tata letak`}
                        onClick={onRemove}
                    >
                        <X className="size-4" />
                    </button>
                )}
            </header>
            <div className="min-h-0 flex-1 px-3 pt-2">
                <AnalyticsWidgetRenderer widget={widget} size={size} bounded />
            </div>
            <footer className="flex h-6 shrink-0 items-center gap-1 pr-9 pl-3 text-xs text-muted-foreground">
                <span className="mr-auto">{editable ? labels[size] : ''}</span>
                {editable && columns === 1 && (
                    <>
                        <button
                            type="button"
                            aria-label={`Naikkan ${widget.title}`}
                            onClick={() => onMove(-1)}
                            className="p-1"
                        >
                            <ArrowUp className="size-4" />
                        </button>
                        <button
                            type="button"
                            aria-label={`Turunkan ${widget.title}`}
                            onClick={() => onMove(1)}
                            className="p-1"
                        >
                            <ArrowDown className="size-4" />
                        </button>
                    </>
                )}
                {editable && (
                    <button
                        type="button"
                        className="analytics-resize-grip absolute right-1 bottom-1 size-6 touch-none border-0 bg-transparent p-0 text-neutral-400 hover:text-emerald-500 focus-visible:text-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                        style={{ cursor: 'nwse-resize' }}
                        aria-label={`Ubah ukuran ${widget.title}. Tarik sudut atau gunakan tombol panah.`}
                        onPointerDown={(e) => {
                            if (e.button !== 0) {
                                return;
                            }

                            e.preventDefault();
                            e.currentTarget.setPointerCapture(e.pointerId);
                            gesture.current = {
                                x: e.clientX,
                                y: e.clientY,
                                width:
                                    (node.current!.getBoundingClientRect()
                                        .width -
                                        (footprints[size][0] - 1) * GRID_GAP) /
                                    footprints[size][0],
                                original: size,
                                next: size,
                            };
                            setResizeColumnWidth(gesture.current.width);
                            setNotice(labels[size]);
                            setResizing(size);
                        }}
                        onPointerMove={(e) => {
                            const g = gesture.current;

                            if (!g) {
                                return;
                            }

                            const dx = e.clientX - g.x,
                                dy = e.clientY - g.y;
                            g.next = resizePreset(
                                g.original,
                                dx,
                                dy,
                                g.width,
                                columns,
                            );
                            setResizing(g.next);
                            setNotice(
                                footprints[g.original][0] +
                                    dx / (g.width + GRID_GAP) >
                                    2 ||
                                    footprints[g.original][1] +
                                        dy / (ROW_HEIGHT + GRID_GAP) >
                                        2
                                    ? 'Ukuran maksimum: 2 × 2'
                                    : labels[g.next],
                            );
                        }}
                        onPointerUp={(e) => {
                            const g = gesture.current;
                            gesture.current = null;
                            setResizing(null);

                            if (
                                e.currentTarget.hasPointerCapture(e.pointerId)
                            ) {
                                e.currentTarget.releasePointerCapture(
                                    e.pointerId,
                                );
                            }

                            if (g && g.next !== size) {
                                onResize(g.next);
                            }
                        }}
                        onPointerCancel={() => {
                            gesture.current = null;
                            setResizing(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                gesture.current = null;
                                setResizing(null);

                                return;
                            }

                            if (
                                ![
                                    'ArrowUp',
                                    'ArrowDown',
                                    'ArrowLeft',
                                    'ArrowRight',
                                ].includes(e.key)
                            ) {
                                return;
                            }

                            e.preventDefault();
                            onResize(
                                resizePreset(
                                    size,
                                    e.key === 'ArrowRight'
                                        ? 10000
                                        : e.key === 'ArrowLeft'
                                          ? -10000
                                          : 0,
                                    e.key === 'ArrowDown'
                                        ? 10000
                                        : e.key === 'ArrowUp'
                                          ? -10000
                                          : 0,
                                    300,
                                    columns,
                                ),
                            );
                        }}
                    >
                        <span
                            aria-hidden="true"
                            className="analytics-resize-ridges"
                        />
                    </button>
                )}
            </footer>
            {editable && resizing && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-px -left-px z-30 rounded-xl border-2 border-dashed border-emerald-500/60 bg-emerald-500/[0.03]"
                    style={{
                        width: pw * resizeColumnWidth + (pw - 1) * GRID_GAP,
                        height: ph * ROW_HEIGHT + (ph - 1) * GRID_GAP,
                    }}
                >
                    <span className="absolute right-2 bottom-2 rounded border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                        {notice || labels[resizing]}
                    </span>
                </div>
            )}
            <span className="sr-only" role="status">
                {notice}
            </span>
        </div>
    );
}
function Section({ id, children }: { id: string; children: ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `section:${id}`,
        data: { section: id },
    });

    return (
        <section
            ref={setNodeRef}
            className={`min-w-0 rounded-xl ${isOver ? 'outline outline-2 outline-primary/30' : ''}`}
        >
            {children}
        </section>
    );
}
export default function SectionDashboard({
    widgets,
    layout = defaultSections(),
    editable = false,
    onChange,
    fixedCategories = false,
    hideSectionTitle = false,
}: {
    widgets: ReportWidget[];
    layout?: SectionLayout;
    editable?: boolean;
    onChange?: (layout: SectionLayout) => void;
    fixedCategories?: boolean;
    hideSectionTitle?: boolean;
}) {
    const { ref, width } = useDashboardWidth();
    const [adding, setAdding] = useState<string | null>(null);
    const [active, setActive] = useState<string | null>(null);
    const [manage, setManage] = useState<DashboardSection | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );
    const used = new Set(
        layout.sections.flatMap((s) => s.widgets.map((w) => w.id)),
    );
    const available = widgets.filter((w) => !used.has(w.id));
    const visible = new Set(widgets.map((w) => w.id));
    const sections = layout.sections
        .map((s) => ({
            ...s,
            widgets: s.widgets.filter((w) => visible.has(w.id)),
        }))
        .filter((s) => editable || s.widgets.length);
    function change(next: SectionLayout) {
        if (editable) {
            onChange?.(normalize(next));
        }
    }
    function resize(id: string, size: WidgetSize) {
        change({
            ...layout,
            sections: layout.sections.map((s) => ({
                ...s,
                widgets: s.widgets.map((w) =>
                    w.id === id ? { ...w, size } : w,
                ),
            })),
        });
    }
    function drop({ active: source, over }: DragEndEvent) {
        setActive(null);

        if (!over || !editable || source.id === over.id) {
            return;
        }

        const target = String(over.data.current?.section ?? '');
        const from = layout.sections.find((s) =>
            s.widgets.some((w) => w.id === source.id),
        );

        if (!target || !from) {
            return;
        }

        if (from.id === target && !String(over.id).startsWith('section:')) {
            change({
                ...layout,
                sections: layout.sections.map((s) =>
                    s.id === target
                        ? {
                              ...s,
                              widgets: arrayMove(
                                  s.widgets,
                                  s.widgets.findIndex(
                                      (w) => w.id === source.id,
                                  ),
                                  s.widgets.findIndex((w) => w.id === over.id),
                              ),
                          }
                        : s,
                ),
            });
        } else {
            change(
                moveWidget(
                    layout,
                    String(source.id),
                    target,
                    String(over.id).startsWith('section:')
                        ? undefined
                        : String(over.id),
                ),
            );
        }
    }

    return (
        <div ref={ref} className="min-w-0 space-y-4">
            {editable && (
                <p className="text-xs text-muted-foreground">
                    Geser judul untuk memindahkan · Tarik sudut untuk mengubah
                    ukuran · Semua widget: 1 × 1 hingga 2 × 2
                </p>
            )}
            <DndContext
                sensors={sensors}
                collisionDetection={(args) =>
                    closestCenter({
                        ...args,
                        droppableContainers: args.droppableContainers.filter(
                            (c) =>
                                !String(c.id).startsWith('section:') ||
                                !sections.find(
                                    (s) => `section:${s.id}` === c.id,
                                )?.widgets.length,
                        ),
                    })
                }
                onDragStart={(e) => setActive(String(e.active.id))}
                onDragEnd={drop}
                onDragCancel={() => setActive(null)}
            >
                {sections.map((section) => {
                    const columns =
                        width < 640
                            ? 1
                            : Math.min(section.columns, width < 1100 ? 2 : 3);
                    const cells = pack(section.widgets, columns);

                    return (
                        <Section id={section.id} key={section.id}>
                            {(!hideSectionTitle || editable) && (
                                <div className="mb-3 flex items-center gap-2">
                                    <h2
                                        className={
                                            hideSectionTitle
                                                ? 'sr-only'
                                                : 'mr-auto text-sm font-semibold'
                                        }
                                    >
                                        {section.title || 'Tanpa judul'}
                                    </h2>
                                    {editable && (
                                        <>
                                            {!fixedCategories && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    aria-label={`Pengaturan bagian ${section.title}`}
                                                    onClick={() =>
                                                        setManage(
                                                            structuredClone(
                                                                section,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    <Settings2 className="size-4" />
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={!available.length}
                                                onClick={() =>
                                                    setAdding(section.id)
                                                }
                                            >
                                                <Plus className="size-4" />
                                                Widget
                                            </Button>
                                        </>
                                    )}
                                </div>
                            )}
                            <SortableContext
                                items={section.widgets.map((w) => w.id)}
                                strategy={rectSortingStrategy}
                            >
                                <div
                                    className="grid gap-4"
                                    style={{
                                        gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`,
                                        gridAutoRows: ROW_HEIGHT,
                                    }}
                                >
                                    {cells.map((cell) => (
                                        <Tile
                                            key={cell.id}
                                            widget={
                                                widgets.find(
                                                    (w) => w.id === cell.id,
                                                )!
                                            }
                                            size={cell.size}
                                            columns={columns}
                                            section={section.id}
                                            editable={editable}
                                            style={{
                                                gridColumn: `${cell.x + 1} / span ${cell.w}`,
                                                gridRow: `${cell.y + 1} / span ${cell.h}`,
                                            }}
                                            onResize={(size) =>
                                                resize(cell.id, size)
                                            }
                                            onRemove={() =>
                                                change({
                                                    ...layout,
                                                    sections:
                                                        layout.sections.map(
                                                            (s) => ({
                                                                ...s,
                                                                widgets:
                                                                    s.widgets.filter(
                                                                        (w) =>
                                                                            w.id !==
                                                                            cell.id,
                                                                    ),
                                                            }),
                                                        ),
                                                })
                                            }
                                            onMove={(step) => {
                                                const index =
                                                    section.widgets.findIndex(
                                                        (w) => w.id === cell.id,
                                                    );

                                                if (
                                                    index + step >= 0 &&
                                                    index + step <
                                                        section.widgets.length
                                                ) {
                                                    change({
                                                        ...layout,
                                                        sections:
                                                            layout.sections.map(
                                                                (s) =>
                                                                    s.id ===
                                                                    section.id
                                                                        ? {
                                                                              ...s,
                                                                              widgets:
                                                                                  arrayMove(
                                                                                      s.widgets,
                                                                                      index,
                                                                                      index +
                                                                                          step,
                                                                                  ),
                                                                          }
                                                                        : s,
                                                            ),
                                                    });
                                                }
                                            }}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                            {!cells.length && editable && (
                                <button
                                    type="button"
                                    onClick={() => setAdding(section.id)}
                                    className="w-full rounded-xl border border-dashed p-6 text-sm text-muted-foreground"
                                >
                                    Tarik widget ke sini atau tambah widget
                                </button>
                            )}
                        </Section>
                    );
                })}
                <DragOverlay>
                    {active ? (
                        <div className="rounded-xl border border-neutral-200 bg-card p-4 text-sm shadow-lg dark:border-neutral-800">
                            {widgets.find((w) => w.id === active)?.title}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
            {editable && !fixedCategories && (
                <Button
                    variant="ghost"
                    onClick={() =>
                        change({
                            ...layout,
                            sections: [
                                ...layout.sections,
                                {
                                    id: `section-${crypto.randomUUID()}`,
                                    title: 'Bagian baru',
                                    columns: 2,
                                    order: layout.sections.length,
                                    widgets: [],
                                },
                            ],
                        })
                    }
                    disabled={layout.sections.length >= 20}
                >
                    <Plus className="size-4" />
                    Tambah bagian
                </Button>
            )}
            <Dialog
                open={!!adding}
                onOpenChange={(open) => {
                    if (!open) {
                        setAdding(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tambah widget</DialogTitle>
                        <DialogDescription>
                            Pilih satu widget untuk langsung menambahkannya.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        {available.map((w) => (
                            <Button
                                key={w.id}
                                variant="outline"
                                className="justify-between"
                                onClick={() => {
                                    change({
                                        ...layout,
                                        sections: layout.sections.map((s) =>
                                            s.id === adding
                                                ? {
                                                      ...s,
                                                      widgets: [
                                                          ...s.widgets,
                                                          {
                                                              id: w.id,
                                                              size: 'small',
                                                              order: s.widgets
                                                                  .length,
                                                          },
                                                      ],
                                                  }
                                                : s,
                                        ),
                                    });
                                    setAdding(null);
                                }}
                            >
                                {w.title}
                                <Plus className="size-4" />
                            </Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog
                open={!!manage}
                onOpenChange={(open) => {
                    if (!open) {
                        setManage(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pengaturan bagian</DialogTitle>
                        <DialogDescription>
                            Pengaturan lanjutan; ukuran maksimum setiap widget
                            tetap 2 × 2.
                        </DialogDescription>
                    </DialogHeader>
                    {manage && (
                        <>
                            <label className="space-y-1 text-sm">
                                Judul
                                <Input
                                    value={manage.title}
                                    maxLength={80}
                                    onChange={(e) =>
                                        setManage({
                                            ...manage,
                                            title: e.target.value,
                                        })
                                    }
                                />
                            </label>
                            <label className="space-y-1 text-sm">
                                Kolom
                                <select
                                    className="ml-3 rounded border bg-background p-2"
                                    value={manage.columns}
                                    onChange={(e) =>
                                        setManage({
                                            ...manage,
                                            columns: Number(e.target.value),
                                        })
                                    }
                                >
                                    {[1, 2, 3].map((n) => (
                                        <option key={n}>{n}</option>
                                    ))}
                                </select>
                            </label>
                            <Button
                                onClick={() => {
                                    change({
                                        ...layout,
                                        sections: layout.sections.map((s) =>
                                            s.id === manage.id ? manage : s,
                                        ),
                                    });
                                    setManage(null);
                                }}
                            >
                                Terapkan
                            </Button>
                            <Button
                                variant="outline"
                                disabled={!!manage.widgets.length}
                                onClick={() => {
                                    change({
                                        ...layout,
                                        sections: layout.sections.filter(
                                            (s) => s.id !== manage.id,
                                        ),
                                    });
                                    setManage(null);
                                }}
                            >
                                Hapus bagian kosong
                            </Button>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
