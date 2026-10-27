import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Empty, Metric, TrendChart, number } from './operational-charts';

export type PostRow = {
    id: number;
    title: string;
    category: string;
    created_at: string | null;
    status: string;
    views: number;
    unique: number;
    likes: number;
    comments: number;
    ratio: number | null;
};
export type PostListing = {
    data: PostRow[];
    page: number;
    last_page: number;
    total: number;
    note: string;
};
export type Inspection = {
    id: number;
    trend: { label: string; likes: number; comments: number }[];
    note: string;
} | null;
export type PostFilters = { search: string; category: string; sort: string };
export default function PostPerformanceTable({
    posts,
    inspection,
    filters,
    categories,
    selectedPost,
    onExport,
}: {
    selectedPost: PostRow | null;
    onExport: (post: PostRow) => void;
    posts: PostListing;
    inspection: Inspection;
    filters: PostFilters;
    categories: { categoryID: number; name: string }[];
}) {
    const [search, setSearch] = useState(filters.search);
    const [loading, setLoading] = useState(false);
    const submitted = useRef(filters.search);
    function visit(values: Record<string, string | number>) {
        const query = new URLSearchParams(window.location.search);
        Object.entries(values).forEach(([k, v]) => {
            if (v === '') {
                query.delete(k);
            } else {
                query.set(k, String(v));
            }
        });
        query.delete('tab');
        query.set('section', 'posts');
        setLoading(true);
        router.get(
            `/admin/analytics?${query}`,
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onFinish: () => setLoading(false),
            },
        );
    }
    useEffect(() => {
        if (search === submitted.current) {
            return;
        }

        const timer = window.setTimeout(() => {
            submitted.current = search;
            const query = new URLSearchParams(window.location.search);
            query.set('search', search);
            query.set('posts_page', '1');
            query.delete('tab');
            query.set('section', 'posts');
            query.delete('post');
            router.get(
                `/admin/analytics?${query}`,
                {},
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 350);

        return () => clearTimeout(timer);
    }, [search]);
    const selected = selectedPost;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                <Input
                    className="w-full sm:w-64"
                    aria-label="Cari judul berita"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari judul berita…"
                />
                <Select
                    value={filters.category || 'all'}
                    onValueChange={(v) =>
                        visit({
                            category: v === 'all' ? '' : v,
                            posts_page: 1,
                            post: '',
                        })
                    }
                >
                    <SelectTrigger
                        className="w-full sm:w-48"
                        aria-label="Kategori berita"
                    >
                        <SelectValue placeholder="Semua kategori" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua kategori</SelectItem>
                        {categories.map((c) => (
                            <SelectItem
                                key={c.categoryID}
                                value={String(c.categoryID)}
                            >
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={filters.sort}
                    onValueChange={(v) =>
                        visit({ sort: v, posts_page: 1, post: '' })
                    }
                >
                    <SelectTrigger
                        className="w-full sm:w-52"
                        aria-label="Urutkan berita"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {[
                            ['views', 'Tayangan terbanyak'],
                            ['unique', 'Identitas unik kumulatif'],
                            ['likes', 'Suka terbanyak'],
                            ['comments', 'Komentar terbanyak'],
                            ['newest', 'Tanggal dibuat terbaru'],
                        ].map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <p className="text-xs text-muted-foreground">{posts.note}</p>
            <Card className="gap-0 overflow-hidden py-0 shadow-none">
                <div className="overflow-x-auto" aria-busy={loading}>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {[
                                    'Judul berita',
                                    'Kategori',
                                    'Tanggal dibuat*',
                                    'Tayangan kumulatif (kali)',
                                    'Identitas unik kumulatif*',
                                    'Suka (periode)',
                                    'Komentar (periode)',
                                    'Aksi',
                                ].map((t) => (
                                    <TableHead
                                        key={t}
                                        className="whitespace-nowrap"
                                    >
                                        {t}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {posts.data.map((p) => (
                                <TableRow
                                    key={p.id}
                                    data-state={
                                        selected?.id === p.id
                                            ? 'selected'
                                            : undefined
                                    }
                                >
                                    <TableCell className="max-w-80 min-w-56 font-medium whitespace-normal">
                                        {p.title}
                                        <div className="text-xs font-normal text-muted-foreground">
                                            {p.status === 'active'
                                                ? 'Aktif'
                                                : 'Diarsipkan / tidak aktif'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {p.category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {p.created_at
                                            ? new Date(
                                                  p.created_at,
                                              ).toLocaleDateString('id-ID')
                                            : '—'}
                                    </TableCell>
                                    {[
                                        p.views,
                                        p.unique,
                                        p.likes,
                                        p.comments,
                                    ].map((v, i) => (
                                        <TableCell
                                            className="text-right tabular-nums"
                                            key={i}
                                        >
                                            {number(v)}
                                        </TableCell>
                                    ))}
                                    <TableCell>
                                        <Button
                                            size="sm"
                                            variant={
                                                p.id === selected?.id
                                                    ? 'secondary'
                                                    : 'ghost'
                                            }
                                            onClick={() =>
                                                visit({ post: p.id })
                                            }
                                            disabled={loading}
                                            aria-label={`Inspeksi ${p.title}`}
                                        >
                                            Inspeksi
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onExport(p)}
                                            aria-label={`Ekspor ${p.title}`}
                                        >
                                            Ekspor
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {!posts.data.length && (
                    <Empty>
                        Tidak ada berita sesuai pencarian dan kategori ini.
                    </Empty>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs">
                    <span>
                        {number(posts.total)} berita · Halaman {posts.page} /{' '}
                        {posts.last_page}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={posts.page <= 1 || loading}
                            onClick={() =>
                                visit({ posts_page: posts.page - 1, post: '' })
                            }
                        >
                            Sebelumnya
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={posts.page >= posts.last_page || loading}
                            onClick={() =>
                                visit({ posts_page: posts.page + 1, post: '' })
                            }
                        >
                            Berikutnya
                        </Button>
                    </div>
                </div>
            </Card>
            <p className="text-xs text-muted-foreground">
                *Tanggal terbit terpisah tidak tersedia. Jangan menjumlahkan
                identitas unik antarartikel untuk menghitung jangkauan platform.
                Identitas mencakup akun dan tamu; bukan jumlah orang terdaftar.
            </p>
            {selected && inspection ? (
                <Card className="shadow-none">
                    <CardHeader>
                        <Button
                            className="w-fit"
                            variant="outline"
                            onClick={() => onExport(selected)}
                        >
                            Ekspor berita ini
                        </Button>
                        <CardTitle className="text-base">
                            Inspeksi: {selected.title}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            {selected.category} · Tren mengikuti periode tanggal
                            di atas
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <Metric
                                label="Tayangan kumulatif"
                                value={selected.views}
                                note="Termasuk kunjungan berulang."
                            />
                            <Metric
                                label="Suka / komentar (periode)"
                                value={`${number(selected.likes)} / ${number(selected.comments)}`}
                                note="Dibuat dalam periode terpilih; hanya suka aktif dan komentar yang kini diterbitkan."
                            />
                            <Metric
                                label="Komposisi suka : komentar"
                                value={
                                    selected.likes + selected.comments
                                        ? `${Math.round((selected.likes / (selected.likes + selected.comments)) * 100)}% : ${Math.round((selected.comments / (selected.likes + selected.comments)) * 100)}%`
                                        : '—'
                                }
                                note="Bagian dari jumlah interaksi tersimpan."
                            />
                        </div>
                        <TrendChart
                            title="Tren Interaksi Harian Berita"
                            yLabel="Interaksi (jumlah)"
                            description="Tanggal dibuatnya suka aktif dan komentar yang kini diterbitkan. Grafik ini tidak menunjukkan tayangan harian."
                            rows={inspection.trend}
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
                        <p className="text-xs text-muted-foreground">
                            {inspection.note}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Empty>
                    Pilih Inspeksi pada berita untuk melihat rincian dan tren
                    interaksi di sini.
                </Empty>
            )}
        </div>
    );
}
