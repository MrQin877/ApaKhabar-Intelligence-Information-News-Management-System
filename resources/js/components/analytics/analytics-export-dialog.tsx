import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { PostFilters, PostRow } from './post-performance-table';

const scopes: Record<string, string> = {
    all: 'Semua kategori',
    summary: 'Ringkasan',
    audience: 'Pengguna, aktivitas & website',
    posts: 'Kinerja berita',
    broadcasts: 'Siaran',
    social: 'Facebook & Instagram',
};
const sheets: Record<string, string> = {
    all: 'Ringkasan · Pengguna · Berita · Siaran · Website · Aktivitas · Facebook · Instagram · Definisi',
    summary: 'Ringkasan · Definisi',
    audience: 'Pengguna · Aktivitas · Website · Definisi',
    posts: 'Berita · Definisi',
    broadcasts: 'Siaran · Definisi',
    social: 'Facebook · Instagram · Definisi',
    post: 'Ringkasan berita · Berita · Definisi',
};
export default function AnalyticsExportDialog({
    open,
    onOpenChange,
    tab,
    filters,
    postFilters,
    post,
}: {
    open: boolean;
    onOpenChange: (value: boolean) => void;
    tab: string;
    filters: { from: string; to: string; source: string; platform: string };
    postFilters: PostFilters;
    post: PostRow | null;
}) {
    const [format, setFormat] = useState('xlsx');
    const [scope, setScope] = useState(post ? 'post' : tab);
    const query = new URLSearchParams({
        ...filters,
        ...postFilters,
        export: format,
        scope: scope === 'post' ? 'posts' : scope,
    });

    if (scope === 'post' && post) {
        query.set('export_post', String(post.id));
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Ekspor laporan analitik</DialogTitle>
                    <DialogDescription>
                        {filters.from} — {filters.to}. Setiap metrik menyertakan
                        kategori, kanal, satuan, cakupan, dan penjelasan.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <label
                        className="text-sm font-medium"
                        htmlFor="export-format"
                    >
                        Format laporan
                    </label>
                    <Select value={format} onValueChange={setFormat}>
                        <SelectTrigger id="export-format">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="xlsx">
                                Excel (.xlsx) — lembar & grafik
                            </SelectItem>
                            <SelectItem value="csv">
                                CSV (.csv) — tabel data
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label
                        className="text-sm font-medium"
                        htmlFor="export-scope"
                    >
                        Isi laporan
                    </label>
                    <Select value={scope} onValueChange={setScope}>
                        <SelectTrigger id="export-scope">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(scopes).map(([key, value]) => (
                                <SelectItem key={key} value={key}>
                                    {value}
                                </SelectItem>
                            ))}
                            {post && (
                                <SelectItem value="post">
                                    Berita ini saja
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                {scope === 'post' && post && (
                    <p className="rounded-lg border p-3 text-sm font-medium">
                        {post.title}
                    </p>
                )}
                <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
                    <p className="font-medium">
                        {format === 'xlsx'
                            ? 'Lembar Excel yang disertakan'
                            : 'Satu tabel CSV dengan kolom kategori'}
                    </p>
                    <p className="text-muted-foreground">{sheets[scope]}</p>
                    <p className="text-xs text-muted-foreground">
                        {format === 'xlsx'
                            ? 'Grafik tersedia untuk data bertanggal dan kategori siaran. Lembar definisi membantu membaca satuan dan batasan data.'
                            : 'CSV tidak mendukung tab atau grafik. Gunakan Excel untuk laporan visual dengan beberapa lembar.'}
                    </p>
                </div>
                <p className="text-xs text-muted-foreground">
                    Filter judul dan kategori berlaku untuk daftar berita.
                    Ekspor mencakup semua hasil, termasuk di luar halaman tabel.
                    Tayangan kumulatif tidak dibatasi tanggal; metrik yang belum
                    dilacak diberi status “Belum tersedia”.
                </p>
                <Button asChild>
                    <a href={`/admin/analytics?${query}`}>
                        <Download /> Unduh {format === 'xlsx' ? 'Excel' : 'CSV'}
                    </a>
                </Button>
            </DialogContent>
        </Dialog>
    );
}
