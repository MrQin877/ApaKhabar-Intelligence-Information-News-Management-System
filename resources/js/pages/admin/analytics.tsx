import { arrayMove } from '@dnd-kit/sortable';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Check,
    CircleHelp,
    Download,
    LayoutGrid,
    RefreshCw,
    RotateCcw,
    Save,
    SlidersHorizontal,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import ReportWidgets from '@/components/analytics/report-widgets';
import type {
    ReportWidget,
    WidgetHeight,
    WidgetSpan,
} from '@/components/analytics/report-widgets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';

type LayoutState = {
    order: string[];
    sizes: Record<string, { span: WidgetSpan; height: WidgetHeight }>;
};

type Props = {
    widgets: ReportWidget[];
    filters: { from: string; to: string; source: string; platform: string };
    catalog: Record<string, string>;
    configuration: {
        widgets: string[];
        period_days: number;
        layout?: LayoutState;
        updated_at: string | null;
        meta_connection_ids: number[];
    };
    connections: { id: number; platform: string; account_name: string }[];
};

function buildInitialLayout(
    widgets: ReportWidget[],
    configured?: LayoutState,
): LayoutState {
    const allIds = widgets.map((w) => w.id);
    const order = configured?.order?.length
        ? [
              ...configured.order.filter((id) => allIds.includes(id)),
              ...allIds.filter((id) => !configured.order.includes(id)),
          ]
        : allIds;

    const sizes: Record<string, { span: WidgetSpan; height: WidgetHeight }> =
        {};
    for (const w of widgets) {
        const saved = configured?.sizes?.[w.id];
        sizes[w.id] = {
            span:
                saved?.span ??
                w.span ??
                (w.id === 'categories' || w.id === 'activity' ? 2 : 1),
            height: saved?.height ?? w.height ?? 'md',
        };
    }

    return { order, sizes };
}

export default function Analytics({
    widgets,
    filters,
    catalog,
    configuration,
    connections,
}: Props) {
    const initialLayout = useMemo(
        () => buildInitialLayout(widgets, configuration.layout),
        [widgets, configuration.layout],
    );

    const form = useForm({
        widgets: configuration.widgets,
        period_days: configuration.period_days,
        layout: initialLayout,
    });

    const meta = useForm({ connection_ids: configuration.meta_connection_ids });
    const [editMode, setEditMode] = useState(false);
    const [preview, setPreview] = useState(false);
    const [range, setRange] = useState(filters);
    const { errors } = usePage().props;

    const orderedWidgets = useMemo(() => {
        const byId = new Map(widgets.map((w) => [w.id, w]));
        const result: ReportWidget[] = [];
        for (const id of form.data.layout.order) {
            const item = byId.get(id);
            if (item) {
                result.push(item);
                byId.delete(id);
            }
        }
        for (const rest of byId.values()) {
            result.push(rest);
        }
        return result;
    }, [widgets, form.data.layout.order]);

    function handleReorder(activeId: string, overId: string) {
        const currentOrder = form.data.layout.order;
        const oldIndex = currentOrder.indexOf(activeId);
        const newIndex = currentOrder.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return;
        }
        const nextOrder = arrayMove(currentOrder, oldIndex, newIndex);
        form.setData('layout', {
            ...form.data.layout,
            order: nextOrder,
        });
    }

    function handleChangeSpan(id: string, span: WidgetSpan) {
        form.setData('layout', {
            ...form.data.layout,
            sizes: {
                ...form.data.layout.sizes,
                [id]: {
                    ...(form.data.layout.sizes[id] ?? {
                        span: 1,
                        height: 'md',
                    }),
                    span,
                },
            },
        });
    }

    function handleChangeHeight(id: string, height: WidgetHeight) {
        form.setData('layout', {
            ...form.data.layout,
            sizes: {
                ...form.data.layout.sizes,
                [id]: {
                    ...(form.data.layout.sizes[id] ?? {
                        span: 1,
                        height: 'md',
                    }),
                    height,
                },
            },
        });
    }

    function handleToggleModerator(id: string) {
        const exists = form.data.widgets.includes(id);
        form.setData(
            'widgets',
            exists
                ? form.data.widgets.filter((k) => k !== id)
                : [...form.data.widgets, id],
        );
    }

    function applyPreset(preset: 'balanced' | 'wide' | 'compact') {
        const nextSizes: Record<
            string,
            { span: WidgetSpan; height: WidgetHeight }
        > = {};
        for (const id of form.data.layout.order) {
            if (preset === 'wide') {
                nextSizes[id] = { span: 2, height: 'md' };
            } else if (preset === 'compact') {
                nextSizes[id] = { span: 1, height: 'sm' };
            } else {
                nextSizes[id] = {
                    span: id === 'categories' || id === 'activity' ? 2 : 1,
                    height: 'md',
                };
            }
        }
        form.setData('layout', {
            ...form.data.layout,
            sizes: nextSizes,
        });
    }

    function resetLayout() {
        form.setData({
            widgets: configuration.widgets,
            period_days: configuration.period_days,
            layout: initialLayout,
        });
        setEditMode(false);
    }

    function saveLayout() {
        form.put('/admin/analytics/dashboard', {
            preserveScroll: true,
            onSuccess: () => setEditMode(false),
        });
    }

    function move(index: number, step: number) {
        const next = [...form.data.widgets];
        [next[index], next[index + step]] = [next[index + step], next[index]];
        form.setData('widgets', next);
    }

    return (
        <Dialog>
            <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6">
                <Head title="Analisis" />
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant="secondary"
                                className="text-xs font-semibold tracking-wider text-primary uppercase"
                            >
                                Khusus admin
                            </Badge>
                        </div>
                        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
                            Analisis warga & publikasi
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                            type="button"
                            variant={editMode ? 'default' : 'outline'}
                            className="gap-2"
                            onClick={() => setEditMode(!editMode)}
                        >
                            <LayoutGrid className="size-4" />
                            {editMode ? 'Selesai Atur' : 'Atur Tata Letak'}
                        </Button>
                        <a
                            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3.5 text-sm font-medium transition hover:bg-muted"
                            href={`/admin/analytics?${new URLSearchParams({ ...filters, export: 'csv' })}`}
                        >
                            <Download className="size-4 text-muted-foreground" />
                            Ekspor CSV
                        </a>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <SlidersHorizontal className="size-4" />
                                Pengaturan analisis
                            </Button>
                        </DialogTrigger>
                    </div>
                </header>

                {editMode && (
                    <div className="sticky top-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-primary/50 bg-card/95 p-4 shadow-lg backdrop-blur-md">
                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-primary text-primary-foreground">
                                    Mode Atur Tata Letak
                                </Badge>
                                <span className="text-xs font-medium text-muted-foreground">
                                    Tahan & geser kartu untuk memindahkan
                                    urutan secara langsung
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                                <span className="text-muted-foreground">
                                    Preset cepat:
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => applyPreset('balanced')}
                                >
                                    Seimbang (Default)
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => applyPreset('wide')}
                                >
                                    Semua Lebar (2 Kolom)
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => applyPreset('compact')}
                                >
                                    Ringkas (S)
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                Periode Dasbor:
                                <select
                                    className="h-8 rounded-md border bg-background px-2.5 text-xs text-foreground"
                                    value={form.data.period_days}
                                    onChange={(e) =>
                                        form.setData(
                                            'period_days',
                                            Number(e.target.value),
                                        )
                                    }
                                >
                                    {[7, 14, 30, 90, 180, 365].map((n) => (
                                        <option key={n} value={n}>
                                            {n} hari terakhir
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1.5"
                                onClick={resetLayout}
                            >
                                <RotateCcw className="size-3.5" />
                                Batal
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className="gap-1.5"
                                disabled={form.processing}
                                onClick={saveLayout}
                            >
                                <Save className="size-3.5" />
                                Simpan Tata Letak
                            </Button>
                        </div>
                    </div>
                )}

                {form.recentlySuccessful && !editMode && (
                    <div
                        role="status"
                        className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    >
                        <Check className="size-4" />
                        Tata letak & pengaturan dasbor berhasil disimpan.
                    </div>
                )}

                <form
                    className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-xs"
                    onSubmit={(e) => {
                        e.preventDefault();
                        router.get('/admin/analytics', range, {
                            preserveState: true,
                            preserveScroll: true,
                        });
                    }}
                >
                    <label className="space-y-1 text-xs font-medium text-muted-foreground">
                        Dari
                        <Input
                            type="date"
                            required
                            className="mt-1 text-foreground"
                            value={range.from}
                            onChange={(e) =>
                                setRange({ ...range, from: e.target.value })
                            }
                        />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-muted-foreground">
                        Sampai
                        <Input
                            type="date"
                            required
                            min={range.from}
                            className="mt-1 text-foreground"
                            value={range.to}
                            onChange={(e) =>
                                setRange({ ...range, to: e.target.value })
                            }
                        />
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Sumber publikasi
                        <select
                            className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                            value={range.source}
                            onChange={(e) =>
                                setRange({ ...range, source: e.target.value })
                            }
                        >
                            <option value="news">Berita</option>
                            <option value="broadcast">Siaran</option>
                        </select>
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Aktivitas
                        <select
                            className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                            value={range.platform}
                            onChange={(e) =>
                                setRange({ ...range, platform: e.target.value })
                            }
                        >
                            <option value="all">Semua platform</option>
                            <option value="web">Website</option>
                            <option value="mobile">Aplikasi mobile</option>
                        </select>
                    </label>
                    <Button type="submit">Terapkan</Button>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="mb-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                    aria-label="Info filter analisis"
                                >
                                    <CircleHelp className="size-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs leading-relaxed">
                                Maksimal 366 hari. Demografi selalu
                                menggambarkan profil saat ini. Sumber publikasi
                                mengubah kategori & tren; platform mengubah
                                aktivitas.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </form>

                {(['from', 'to', 'source', 'platform'] as const).map(
                    (key) =>
                        errors[key] && (
                            <p
                                key={key}
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {errors[key]}
                            </p>
                        ),
                )}

                <ReportWidgets
                    widgets={orderedWidgets}
                    editable={editMode}
                    moderatorWidgets={form.data.widgets}
                    sizes={form.data.layout.sizes}
                    onReorder={handleReorder}
                    onChangeSpan={handleChangeSpan}
                    onChangeHeight={handleChangeHeight}
                    onToggleModerator={handleToggleModerator}
                />

                <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-3xl">
                    <DialogHeader className="shrink-0 border-b px-6 pt-6 pr-12 pb-4">
                        <DialogTitle>Pengaturan analisis</DialogTitle>
                        <DialogDescription>
                            Kelola akun media sosial dan ringkasan yang dapat
                            dilihat moderator.
                        </DialogDescription>
                    </DialogHeader>
                    <Tabs
                        defaultValue="accounts"
                        className="min-h-0 overflow-y-auto px-4 pb-6 sm:px-6"
                    >
                        <TabsList
                            className="w-full shrink-0"
                            aria-label="Pengaturan analisis"
                        >
                            <TabsTrigger value="accounts">
                                Akun & sinkronisasi
                            </TabsTrigger>
                            <TabsTrigger value="moderator">
                                Dashboard moderator
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="moderator">
                            <form
                                className="mt-5 space-y-4"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    form.put('/admin/analytics/dashboard', {
                                        preserveScroll: true,
                                    });
                                }}
                            >
                                <p className="text-sm text-muted-foreground">
                                    Satu konfigurasi untuk semua moderator.
                                    Hanya ringkasan terpilih yang dibagikan;
                                    halaman Analisis tetap khusus admin.
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {Object.entries(catalog).map(
                                        ([key, label]) => (
                                            <label
                                                className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                                                key={key}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={form.data.widgets.includes(
                                                        key,
                                                    )}
                                                    onChange={(e) =>
                                                        form.setData(
                                                            'widgets',
                                                            e.target.checked
                                                                ? [
                                                                      ...form
                                                                          .data
                                                                          .widgets,
                                                                      key,
                                                                  ]
                                                                : form.data.widgets.filter(
                                                                      (k) =>
                                                                          k !==
                                                                          key,
                                                                  ),
                                                        )
                                                    }
                                                />
                                                {label}
                                            </label>
                                        ),
                                    )}
                                </div>
                                <label className="flex items-center gap-3 text-sm">
                                    Periode dasbor
                                    <select
                                        className="rounded border bg-background p-2"
                                        value={form.data.period_days}
                                        onChange={(e) =>
                                            form.setData(
                                                'period_days',
                                                Number(e.target.value),
                                            )
                                        }
                                    >
                                        {[7, 14, 30, 90, 180, 365].map((n) => (
                                            <option key={n} value={n}>
                                                {n} hari terakhir
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <ol className="space-y-2">
                                    {form.data.widgets.map((key, i) => (
                                        <li
                                            key={key}
                                            className="flex items-center gap-3 text-sm"
                                        >
                                            <span className="min-w-0 flex-1">
                                                {i + 1}. {catalog[key]}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={i === 0}
                                                onClick={() => move(i, -1)}
                                                aria-label={`Naikkan ${catalog[key]}`}
                                            >
                                                ↑
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={
                                                    i ===
                                                    form.data.widgets.length - 1
                                                }
                                                onClick={() => move(i, 1)}
                                                aria-label={`Turunkan ${catalog[key]}`}
                                            >
                                                ↓
                                            </Button>
                                        </li>
                                    ))}
                                </ol>
                                {Object.values(form.errors).map((error) => (
                                    <p
                                        key={error}
                                        className="text-sm text-destructive"
                                    >
                                        {error}
                                    </p>
                                ))}
                                <div className="flex flex-wrap gap-3">
                                    <Button disabled={form.processing}>
                                        Simpan pengaturan
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setPreview(!preview)}
                                    >
                                        {preview
                                            ? 'Tutup pratinjau'
                                            : 'Pratinjau pilihan'}
                                    </Button>
                                    {form.recentlySuccessful && (
                                        <span
                                            role="status"
                                            className="self-center text-sm"
                                        >
                                            Pengaturan disimpan.
                                        </span>
                                    )}
                                </div>
                                {preview && (
                                    <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                                        <p className="text-sm text-muted-foreground">
                                            Pratinjau susunan menggunakan data
                                            filter saat ini. Dasbor memakai
                                            periode yang dipilih di atas dan
                                            sumber berita.
                                        </p>
                                        <ReportWidgets
                                            widgets={form.data.widgets.flatMap(
                                                (id) =>
                                                    orderedWidgets.filter(
                                                        (w) => w.id === id,
                                                    ),
                                            )}
                                            sizes={form.data.layout.sizes}
                                        />
                                        {!form.data.widgets.length && (
                                            <p>
                                                Tidak ada ringkasan dibagikan.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form>
                        </TabsContent>
                        <TabsContent value="accounts">
                            <form
                                className="mt-4 space-y-4"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    meta.put('/admin/analytics/meta', {
                                        preserveScroll: true,
                                    });
                                }}
                            >
                                <p className="text-sm text-muted-foreground">
                                    Pilih maksimal satu akun per platform dari
                                    koneksi Anda. Statistik hanya tersedia
                                    setelah izin Insights diberikan dan
                                    sinkronisasi berhasil.
                                </p>
                                {connections.length ? (
                                    connections.map((c) => (
                                        <label
                                            className="flex items-center gap-2.5 rounded-lg border p-3 text-sm"
                                            key={c.id}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={meta.data.connection_ids.includes(
                                                    c.id,
                                                )}
                                                onChange={(e) =>
                                                    meta.setData(
                                                        'connection_ids',
                                                        e.target.checked
                                                            ? [
                                                                  ...meta.data
                                                                      .connection_ids,
                                                                  c.id,
                                                              ]
                                                            : meta.data.connection_ids.filter(
                                                                  (id) =>
                                                                      id !==
                                                                      c.id,
                                                              ),
                                                    )
                                                }
                                            />
                                            <span
                                                className="size-2.5 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        c.platform ===
                                                        'facebook'
                                                            ? '#1877F2'
                                                            : '#E1306C',
                                                }}
                                            />
                                            <span className="font-medium capitalize">
                                                {c.platform}
                                            </span>{' '}
                                            — {c.account_name}
                                        </label>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Hubungkan akun melalui Pengaturan →
                                        Integrasi terlebih dahulu.
                                    </p>
                                )}
                                {Object.values(meta.errors).map((error) => (
                                    <p
                                        key={error}
                                        className="text-sm text-destructive"
                                    >
                                        {error}
                                    </p>
                                ))}
                                <div className="flex flex-wrap gap-3 text-sm">
                                    <a
                                        className="underline"
                                        href="/admin/social/facebook/connect?insights=1"
                                    >
                                        Berikan izin Insights Facebook
                                    </a>
                                    <a
                                        className="underline"
                                        href="/admin/social/instagram/connect?insights=1"
                                    >
                                        Berikan izin Insights Instagram
                                    </a>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Jika menggunakan konfigurasi Business Login,
                                    tambahkan izin Insights pada konfigurasi
                                    aplikasi Meta terlebih dahulu.
                                </p>
                                <Button disabled={meta.processing}>
                                    Simpan akun resmi
                                </Button>
                                {meta.recentlySuccessful && (
                                    <span
                                        className="ml-3 text-sm"
                                        role="status"
                                    >
                                        Akun disimpan.
                                    </span>
                                )}
                            </form>
                            <Button
                                className="mt-3 gap-2"
                                variant="outline"
                                onClick={() =>
                                    router.post(
                                        '/admin/analytics/meta/sync',
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                <RefreshCw className="size-4" />
                                Jadwalkan sinkronisasi
                            </Button>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Proses berjalan di antrean default. Muat ulang
                                halaman setelah sinkronisasi selesai.
                            </p>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </div>
        </Dialog>
    );
}

Analytics.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={[{ title: 'Analisis', href: '/admin/analytics' }]}>
        {page}
    </AppLayout>
);
