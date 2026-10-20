import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Check,
    CircleHelp,
    Download,
    LayoutGrid,
    RefreshCw,
    RotateCcw,
    Undo2,
    SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReportWidget } from '@/components/analytics/report-widgets';
import SectionDashboard, {
    useDashboardWidth,
} from '@/components/analytics/section-dashboard';
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
import { defaultSections } from '@/lib/analytics-sections';
import type { SectionLayout } from '@/lib/analytics-sections';

type Props = {
    widgets: ReportWidget[];
    filters: { from: string; to: string; source: string; platform: string };
    catalog: Record<string, string>;
    configuration: {
        widgets: string[];
        period_days: number;
        layout?: SectionLayout;
        updated_at: string | null;
        meta_connection_ids: number[];
    };
    connections: { id: number; platform: string; account_name: string }[];
};

export default function Analytics({
    widgets,
    filters,
    catalog,
    configuration,
    connections,
}: Props) {
    const initialLayout = useMemo(
        () => configuration.layout ?? defaultSections(),
        [configuration.layout],
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

    const { ref: dashboardRef } = useDashboardWidth();
    const orderedWidgets = widgets;
    const [savedLayout, setSavedLayout] = useState(
        JSON.stringify(initialLayout),
    );
    const history = useRef<SectionLayout[]>([]);
    const [undoCount, setUndoCount] = useState(0);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);
    const layoutKey = JSON.stringify(form.data.layout);
    const dirty = layoutKey !== savedLayout;

    function changeLayout(next: SectionLayout) {
        if (JSON.stringify(next) === layoutKey) {
            return;
        }

        history.current.push(structuredClone(form.data.layout));
        history.current = history.current.slice(-30);
        setUndoCount(history.current.length);
        setSaveError(false);
        form.setData('layout', next);
    }
    function undoLayout() {
        const previous = history.current.pop();

        if (previous) {
            form.setData('layout', previous);
            setUndoCount(history.current.length);
            setSaveError(false);
        }
    }
    // Serialize saves: edits made during a request are sent after it finishes.
    // Only committed gestures enter this queue; previews never write settings.
    useEffect(() => {
        if (!dirty || saving || saveError) {
            return;
        }

        const timer = window.setTimeout(() => {
            setSaving(true);
            router.put(
                '/admin/analytics/dashboard',
                {
                    widgets: configuration.widgets,
                    period_days: configuration.period_days,
                    layout: JSON.parse(layoutKey),
                },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => {
                        setSavedLayout(layoutKey);
                    },
                    onError: () => setSaveError(true),
                    onCancel: () => setSaveError(true),
                    onFinish: () => setSaving(false),
                },
            );
        }, 400);

        return () => window.clearTimeout(timer);
    }, [
        layoutKey,
        dirty,
        saving,
        saveError,
        configuration.widgets,
        configuration.period_days,
    ]);
    useEffect(() => {
        if (!dirty && !saving) {
            return;
        }

        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        window.addEventListener('beforeunload', warn);
        const remove = router.on('before', (event) => {
            if (
                event.detail.visit.method === 'get' &&
                !window.confirm(
                    'Tata letak belum tersimpan. Tinggalkan halaman?',
                )
            ) {
                event.preventDefault();
            }
        });

        return () => {
            window.removeEventListener('beforeunload', warn);
            remove();
        };
    }, [dirty, saving]);

    return (
        <Dialog>
            <div
                ref={dashboardRef}
                className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6"
            >
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
                            disabled={form.processing}
                            onClick={() => setEditMode(!editMode)}
                        >
                            <LayoutGrid className="size-4" />
                            {editMode ? 'Selesai' : 'Atur Tata Letak'}
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

                {(editMode || dirty || saving || saveError) && (
                    <div className="sticky top-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 p-3 backdrop-blur">
                        <div className="space-y-1">
                            <p className="text-sm font-medium">
                                {editMode
                                    ? 'Atur tata letak'
                                    : 'Status tata letak'}
                            </p>
                            <p
                                role="status"
                                className="text-xs text-muted-foreground"
                            >
                                {saveError
                                    ? 'Belum tersimpan. Perubahan tetap tersedia untuk dicoba lagi.'
                                    : saving || dirty
                                      ? 'Menyimpan perubahan…'
                                      : 'Tersimpan otomatis'}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {saveError && (
                                <Button
                                    size="sm"
                                    onClick={() => setSaveError(false)}
                                >
                                    Coba lagi
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={!undoCount}
                                onClick={undoLayout}
                            >
                                <Undo2 className="size-4" />
                                Urungkan
                            </Button>
                            {editMode && (
                                <>
                                    <label className="text-xs">
                                        Susunan
                                        <select
                                            aria-label="Preset tata letak"
                                            className="ml-2 rounded border bg-background p-2"
                                            value=""
                                            onChange={(e) => {
                                                const preset = e.target.value;
                                                changeLayout({
                                                    ...form.data.layout,
                                                    sections:
                                                        form.data.layout.sections.map(
                                                            (section) => ({
                                                                ...section,
                                                                widgets:
                                                                    section.widgets.map(
                                                                        (
                                                                            w,
                                                                        ) => ({
                                                                            ...w,
                                                                            size:
                                                                                preset ===
                                                                                'detail'
                                                                                    ? 'large'
                                                                                    : preset ===
                                                                                            'summary' &&
                                                                                        w.id ===
                                                                                            'overview'
                                                                                      ? 'wide'
                                                                                      : 'small',
                                                                        }),
                                                                    ),
                                                            }),
                                                        ),
                                                });
                                            }}
                                        >
                                            <option value="" disabled>
                                                Pilih preset
                                            </option>
                                            <option value="summary">
                                                Ringkasan
                                            </option>
                                            <option value="balanced">
                                                Seimbang
                                            </option>
                                            <option value="detail">
                                                Detail
                                            </option>
                                        </select>
                                    </label>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            changeLayout(defaultSections())
                                        }
                                    >
                                        <RotateCcw className="size-4" />
                                        Default
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {Object.keys(form.errors).length > 0 && (
                    <div
                        role="alert"
                        className="rounded-xl border border-danger-border bg-danger-bg p-4 text-sm text-danger-text"
                    >
                        <p className="font-medium">
                            Pengaturan belum disimpan.
                        </p>
                        {Object.entries(form.errors).map(([key, message]) => (
                            <p key={key}>{message}</p>
                        ))}
                    </div>
                )}

                {form.recentlySuccessful && !editMode && (
                    <div
                        role="status"
                        className="flex items-center gap-2 rounded-xl border border-success-border bg-success-bg px-4 py-2.5 text-xs font-medium text-success-text"
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

                <SectionDashboard
                    widgets={widgets}
                    layout={form.data.layout}
                    editable={editMode}
                    onChange={changeLayout}
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
                                <p className="text-xs text-muted-foreground">
                                    Urutan mengikuti tata letak di halaman
                                    Analisis. Widget yang dihapus dari tata
                                    letak tidak muncul di dasbor moderator.
                                </p>
                                {Object.values(form.errors).map((error) => (
                                    <p
                                        key={error}
                                        className="text-sm text-destructive"
                                    >
                                        {error}
                                    </p>
                                ))}
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        disabled={
                                            form.processing || saving || dirty
                                        }
                                    >
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
                                        <SectionDashboard
                                            widgets={form.data.widgets.flatMap(
                                                (id) =>
                                                    orderedWidgets.filter(
                                                        (w) => w.id === id,
                                                    ),
                                            )}
                                            layout={form.data.layout}
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
                                                            ? 'var(--platform-facebook)'
                                                            : 'var(--platform-instagram)',
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
