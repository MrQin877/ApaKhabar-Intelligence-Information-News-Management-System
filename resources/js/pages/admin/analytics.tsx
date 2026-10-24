import { Head, router, useForm } from '@inertiajs/react';
import { Download, RefreshCw, RotateCcw, Settings2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AnalyticsExportDialog from '@/components/analytics/analytics-export-dialog';
import {
    BroadcastPanel,
    Metric,
    TrendChart,
} from '@/components/analytics/operational-charts';
import PostPerformanceTable from '@/components/analytics/post-performance-table';
import type {
    PostListing,
    Inspection,
    PostFilters,
    PostRow,
} from '@/components/analytics/post-performance-table';
import type { ReportWidget } from '@/components/analytics/report-widgets';
import SectionDashboard from '@/components/analytics/section-dashboard';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import {
    analyticsCategories,
    categorySections,
    defaultSections,
} from '@/lib/analytics-sections';
import type { SectionLayout } from '@/lib/analytics-sections';

const reportTabs = [
    { id: 'summary', title: 'Ringkasan' },
    { id: 'audience', title: 'Pengguna & Website' },
    { id: 'posts', title: 'Kinerja Berita' },
    { id: 'broadcasts', title: 'Siaran' },
    { id: 'social', title: 'Media Sosial' },
];
type Props = {
    activeTab: string;
    reportingTimezone: string;
    selectedPost: PostRow | null;
    interactionTrend: { label: string; likes: number; comments: number }[];
    widgets: ReportWidget[];
    filters: { from: string; to: string; source: string; platform: string };
    posts: PostListing;
    inspection: Inspection;
    postFilters: PostFilters;
    newsCategories: { categoryID: number; name: string }[];
    configuration: {
        widgets: string[];
        period_days: number;
        layout: SectionLayout;
        meta_connection_ids: number[];
    };
    connections: { id: number; platform: string; account_name: string }[];
};
export default function Analytics({
    widgets,
    filters,
    posts,
    inspection,
    postFilters,
    newsCategories,
    configuration,
    connections,
    activeTab,
    reportingTimezone,
    selectedPost,
    interactionTrend,
}: Props) {
    const tab = activeTab;
    const [exportOpen, setExportOpen] = useState(false);
    const [exportPost, setExportPost] = useState<PostRow | null>(null);
    function selectTab(value: string) {
        const url = new URL(window.location.href);
        url.searchParams.set('section', value);
        url.searchParams.delete('tab');
        // Inertia keeps the current component state while back/forward stays consistent.
        router.replace({
            url: url.pathname + url.search,
            preserveState: true,
            preserveScroll: true,
            props: (current) => ({ ...current, activeTab: value }),
        });
    }
    const [layout, setLayout] = useState(() =>
        categorySections(configuration.layout ?? defaultSections()),
    );
    const [saved, setSaved] = useState(() =>
        JSON.stringify(
            categorySections(configuration.layout ?? defaultSections()),
        ),
    );
    const [edit, setEdit] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [filterError, setFilterError] = useState('');
    const [range, setRange] = useState(filters);
    const history = useRef<SectionLayout[]>([]);
    const [undos, setUndos] = useState(0);
    const meta = useForm({ connection_ids: configuration.meta_connection_ids });
    const key = JSON.stringify(layout);
    const dirty = key !== saved;
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
                    fixed_categories: true,
                    layout,
                },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => setSaved(key),
                    onError: () =>
                        setSaveError('Tata letak belum tersimpan. Coba lagi.'),
                    onFinish: () => setSaving(false),
                },
            );
        }, 600);

        return () => clearTimeout(timer);
    }, [
        dirty,
        saving,
        saveError,
        key,
        layout,
        configuration.widgets,
        configuration.period_days,
    ]);
    function change(next: SectionLayout) {
        history.current.push(layout);
        setUndos(history.current.length);
        setSaveError('');
        setLayout(next);
    }
    const broadcast = widgets.find((w) => w.id === 'broadcast');
    const accounts = widgets.find((w) => w.id === 'meta')?.accounts ?? [];
    const isLegacy = configuration.layout.sections.some(
        (s) => !analyticsCategories.some((c) => c.id === s.id),
    );

    const overview = widgets.find((w) => w.id === 'overview');
    const interactions = interactionTrend.reduce(
        (sum, day) => sum + day.likes + day.comments,
        0,
    );
    const recorded = broadcast?.rows[1]?.value ?? 0;
    const read = broadcast?.rows[2]?.value ?? 0;
    function renderCategory(id: string) {
        const c = analyticsCategories.find((item) => item.id === id)!;

        return (
            <SectionDashboard
                widgets={widgets.filter((w) => c.widgets.includes(w.id))}
                layout={{
                    version: 2,
                    sections: layout.sections.filter(
                        (section) => section.id === id,
                    ),
                }}
                editable={edit}
                fixedCategories
                hideSectionTitle
                onChange={(next) =>
                    change({
                        version: 2,
                        sections: layout.sections.map((section) =>
                            section.id === id
                                ? { ...next.sections[0], order: section.order }
                                : section,
                        ),
                    })
                }
            />
        );
    }

    return (
        <div className="analytics-redesign min-w-0 space-y-5 p-4 md:p-6">
            <Head title="Analisis" />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Analisis</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Kinerja konten, aktivitas warga, dan hasil siaran
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={() => {
                            setExportPost(null);
                            setExportOpen(true);
                        }}
                    >
                        <Download /> Ekspor laporan
                    </Button>
                    {tab !== 'summary' && (
                        <Button
                            variant="outline"
                            onClick={() => setEdit(!edit)}
                        >
                            <Settings2 />
                            {edit ? 'Selesai' : 'Atur tata letak'}
                        </Button>
                    )}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                Akun & sinkronisasi
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85dvh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Akun resmi Meta</DialogTitle>
                                <DialogDescription>
                                    Pilih maksimal satu akun per platform.
                                    Halaman ini khusus Admin.
                                </DialogDescription>
                            </DialogHeader>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    meta.put('/admin/analytics/meta', {
                                        preserveScroll: true,
                                    });
                                }}
                                className="space-y-3"
                            >
                                {connections.length ? (
                                    connections.map((c) => (
                                        <label
                                            className="flex items-center gap-2 rounded-lg border p-3 text-sm"
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
                                            {c.platform} · {c.account_name}
                                        </label>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Belum ada akun terhubung.
                                    </p>
                                )}
                                {Object.values(meta.errors).map((e) => (
                                    <p
                                        className="text-sm text-destructive"
                                        key={e}
                                    >
                                        {e}
                                    </p>
                                ))}
                                <Button disabled={meta.processing}>
                                    Simpan akun resmi
                                </Button>
                                {meta.recentlySuccessful && (
                                    <p role="status">Akun disimpan.</p>
                                )}
                            </form>
                            <a
                                className="text-sm underline"
                                href="/admin/social/facebook/connect?insights=1"
                            >
                                Hubungkan Facebook / beri izin Insights
                            </a>
                            <a
                                className="text-sm underline"
                                href="/admin/social/instagram/connect?insights=1"
                            >
                                Hubungkan Instagram / beri izin Insights
                            </a>
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.post(
                                        '/admin/analytics/meta/sync',
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                <RefreshCw />
                                Jadwalkan sinkronisasi
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Sinkronisasi berjalan di antrean. Muat ulang
                                setelah selesai; data gagal tidak dianggap nol.
                            </p>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    setFilterError('');
                    router.get(
                        '/admin/analytics',
                        {
                            ...range,
                            ...postFilters,
                            section: tab,
                            ...(inspection ? { post: inspection.id } : {}),
                        },
                        {
                            preserveState: true,
                            preserveScroll: true,
                            onError: (errors) =>
                                setFilterError(Object.values(errors).join(' ')),
                        },
                    );
                }}
            >
                <label className="space-y-1 text-xs text-muted-foreground">
                    Dari
                    <Input
                        type="date"
                        value={range.from}
                        onChange={(e) =>
                            setRange({ ...range, from: e.target.value })
                        }
                        required
                    />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                    Sampai
                    <Input
                        type="date"
                        value={range.to}
                        min={range.from}
                        onChange={(e) =>
                            setRange({ ...range, to: e.target.value })
                        }
                        required
                    />
                </label>
                <Button type="submit" variant="outline">
                    Terapkan
                </Button>
                <p className="self-center text-xs text-muted-foreground">
                    Zona waktu: {reportingTimezone} · Periode untuk interaksi &
                    aktivitas; profil dan tayangan kumulatif diberi label
                    tersendiri
                </p>
            </form>
            {filterError && (
                <Alert variant="destructive">
                    <AlertDescription>{filterError}</AlertDescription>
                </Alert>
            )}
            {isLegacy && (
                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="link"
                            className="h-auto max-w-full p-0 text-left text-xs whitespace-normal"
                        >
                            Susunan lama dipetakan ke kategori standar · Lihat
                            pemetaan
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Pemetaan tata letak lama</DialogTitle>
                            <DialogDescription>
                                Ukuran, urutan relatif, dan widget tersembunyi
                                dipertahankan. Susunan lama tetap tersimpan
                                hingga Anda mengubah tata letak; cadangannya
                                dicatat saat penyimpanan pertama.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
                            {configuration.layout.sections.map((s) => (
                                <div
                                    key={s.id}
                                    className="rounded-lg border p-3"
                                >
                                    <strong>{s.title || 'Tanpa judul'}</strong>
                                    {s.widgets.map((w) => (
                                        <p
                                            key={w.id}
                                            className="text-xs text-muted-foreground"
                                        >
                                            {widgets.find((x) => x.id === w.id)
                                                ?.title ?? w.id}{' '}
                                            →{' '}
                                            {analyticsCategories.find((c) =>
                                                c.widgets.includes(w.id),
                                            )?.title ??
                                                'Digantikan tabel interaksi berita'}
                                        </p>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
            {edit && (
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                        {saving
                            ? 'Menyimpan…'
                            : dirty
                              ? 'Perubahan belum tersimpan'
                              : 'Tersimpan'}
                    </Badge>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={!undos}
                        onClick={() => {
                            const previous = history.current.pop();

                            if (previous) {
                                setLayout(previous);
                                setSaveError('');
                                setUndos(history.current.length);
                            }
                        }}
                    >
                        <Undo2 />
                        Urungkan
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            change(categorySections(defaultSections()))
                        }
                    >
                        <RotateCcw />
                        Pulihkan bawaan
                    </Button>
                    {saveError && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSaveError('')}
                        >
                            Coba simpan lagi
                        </Button>
                    )}
                </div>
            )}
            {saveError && (
                <Alert variant="destructive">
                    <AlertDescription>{saveError}</AlertDescription>
                </Alert>
            )}

            {exportOpen && (
                <AnalyticsExportDialog
                    open={exportOpen}
                    onOpenChange={setExportOpen}
                    tab={tab}
                    filters={filters}
                    postFilters={postFilters}
                    post={exportPost}
                />
            )}
            <Tabs
                value={tab}
                onValueChange={selectTab}
                className="min-w-0 gap-5"
            >
                <TabsList className="grid h-auto! w-full grid-cols-2 gap-1 p-1 sm:flex">
                    {reportTabs.map((item) => (
                        <TabsTrigger
                            key={item.id}
                            value={item.id}
                            className="h-auto min-h-10 flex-1 px-3"
                        >
                            {item.title}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent value="summary" className="min-w-0 space-y-5">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Apa yang terjadi dalam periode ini?
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {filters.from} — {filters.to} · Rincian dan definisi
                            tersedia di setiap tab.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Metric
                            label="Warga aktif"
                            value={overview?.rows[2]?.value ?? 'Belum tersedia'}
                            note={`Akun warga unik dengan aktivitas tercatat dalam periode · platform: ${filters.platform === 'all' ? 'web dan aplikasi' : filters.platform}.`}
                        />
                        <Metric
                            label="Interaksi berita"
                            value={interactions}
                            note="Jumlah suka aktif dan komentar yang kini diterbitkan, dibuat dalam periode. Tidak termasuk tayangan."
                        />
                        <Metric
                            label="Rasio baca siaran"
                            value={
                                recorded
                                    ? `${((read / recorded) * 100).toFixed(1)}%`
                                    : '—'
                            }
                            note="Notifikasi dibaca ÷ tercatat untuk siaran dikirim dalam periode. Status baca saat ini; bukan bukti terkirim ke perangkat."
                        />
                    </div>
                    <TrendChart
                        title="Respons warga terhadap berita"
                        rows={interactionTrend}
                        yLabel="Interaksi (jumlah)"
                        description="Suka dan komentar mengikuti tanggal dibuat dalam periode. Riwayat tayangan harian belum tersedia."
                        series={[
                            {
                                key: 'likes',
                                label: 'Suka aktif',
                                color: '#16a34a',
                            },
                            {
                                key: 'comments',
                                label: 'Komentar diterbitkan',
                                color: '#0d9488',
                            },
                        ]}
                    />
                    <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                        <strong className="text-foreground">
                            Baca angka sesuai cakupannya.
                        </strong>{' '}
                        Warga aktif adalah akun terdaftar. Identitas unik berita
                        mencakup akun dan tamu. Tayangan berita dapat berulang
                        dan tidak sama dengan kunjungan seluruh website.
                    </div>
                </TabsContent>
                <TabsContent value="audience" className="min-w-0 space-y-5">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Pengguna, profil & akses website
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Profil akun warga saat ini, bukan sensus penduduk.
                            Demografi tidak mengikuti filter tanggal.
                        </p>
                    </div>
                    {renderCategory('summary')}
                    {renderCategory('audience')}
                    <div className="rounded-xl border p-4">
                        <h3 className="font-medium">Akses seluruh website</h3>
                        <Badge variant="secondary" className="mt-2">
                            Belum dilacak
                        </Badge>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Kunjungan, sesi, dan pengunjung unik website
                            memerlukan pelacakan tersendiri. Tayangan berita
                            ditampilkan pada Kinerja Berita dan tidak digunakan
                            sebagai pengganti metrik ini.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-medium">Kapan warga aktif?</h3>
                        <Select
                            value={filters.platform}
                            onValueChange={(platform) => {
                                setRange((current) => ({
                                    ...current,
                                    platform,
                                }));
                                router.get(
                                    '/admin/analytics',
                                    {
                                        ...filters,
                                        ...postFilters,
                                        platform,
                                        section: 'audience',
                                    },
                                    {
                                        preserveState: true,
                                        preserveScroll: true,
                                    },
                                );
                            }}
                        >
                            <SelectTrigger
                                className="w-48"
                                aria-label="Platform aktivitas"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    Semua platform
                                </SelectItem>
                                <SelectItem value="web">Web portal</SelectItem>
                                <SelectItem value="mobile">
                                    Aplikasi mobile
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {renderCategory('activity')}
                    <p className="text-xs text-muted-foreground">
                        Nilai heatmap adalah akun warga unik per kombinasi
                        hari/jam dalam periode dan platform terpilih. Akun yang
                        sama dapat muncul pada beberapa slot; jangan
                        menjumlahkannya sebagai total pengguna unik.
                    </p>
                </TabsContent>
                <TabsContent value="posts" className="min-w-0 space-y-5">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Kinerja berita & respons warga
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Tayangan dan identitas unik bersifat kumulatif. Suka
                            dan komentar mengikuti {filters.from} — {filters.to}
                            .
                        </p>
                    </div>
                    <PostPerformanceTable
                        posts={posts}
                        inspection={inspection}
                        selectedPost={selectedPost}
                        filters={postFilters}
                        categories={newsCategories}
                        onExport={(post) => {
                            setExportPost(post);
                            setExportOpen(true);
                        }}
                    />
                    {renderCategory('posts')}
                </TabsContent>
                <TabsContent value="broadcasts" className="min-w-0 space-y-5">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Efektivitas siaran
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Siaran dikirim dalam periode · status pembacaan saat
                            ini.
                        </p>
                    </div>
                    {renderCategory('broadcasts')}
                    {broadcast && (
                        <>
                            <TrendChart
                                title="Pembacaan menurut kategori siaran"
                                rows={broadcast.category_trend ?? []}
                                bars
                                xLabel="Kategori siaran"
                                yLabel="Notifikasi (jumlah)"
                                description="Tercatat berarti notifikasi dibuat di sistem; bukan konfirmasi perangkat menerima pesan."
                                series={[
                                    {
                                        key: 'recorded',
                                        label: 'Notifikasi tercatat',
                                        color: '#0d9488',
                                    },
                                    {
                                        key: 'read',
                                        label: 'Dibaca',
                                        color: '#16a34a',
                                    },
                                ]}
                            />
                            <BroadcastPanel widget={broadcast} />
                        </>
                    )}
                </TabsContent>
                <TabsContent value="social" className="min-w-0 space-y-5">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Facebook & Instagram
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Bandingkan kanal dalam satu tampilan dengan metrik,
                            satuan, dan status sinkronisasi masing-masing.
                        </p>
                    </div>
                    {accounts
                        .filter((account) =>
                            ['disconnected', 'unavailable'].includes(
                                account.status,
                            ),
                        )
                        .map((account) => (
                            <Alert key={account.platform}>
                                <AlertDescription>
                                    <strong className="capitalize">
                                        {account.platform}
                                    </strong>
                                    : {account.note}
                                    <a
                                        className="ml-2 underline"
                                        href={`/admin/social/${account.platform}/connect?insights=1`}
                                    >
                                        Hubungkan ulang
                                    </a>
                                </AlertDescription>
                            </Alert>
                        ))}
                    {renderCategory('social')}
                    <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                        <strong className="text-foreground">
                            Engagement media sosial: belum tersedia.
                        </strong>{' '}
                        Integrasi saat ini menyediakan kunjungan halaman
                        Facebook dan jangkauan harian Instagram. Reaksi,
                        komentar, dan bagikan tidak dianggap nol. Jangkauan
                        harian tidak boleh dijumlahkan menjadi akun unik
                        bulanan. Periode harian Meta mengikuti UTC; aktivitas
                        warga mengikuti zona waktu pelaporan sistem.
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
Analytics.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={[{ title: 'Analisis', href: '/admin/analytics' }]}>
        {page}
    </AppLayout>
);
