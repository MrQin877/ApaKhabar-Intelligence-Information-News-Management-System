import { Head, Link, router, usePage, usePoll } from '@inertiajs/react';
import { Check, X, Plus, Radio, FolderUp, AlertCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import {
    BroadcastPanel,
    Empty,
    Metric,
    TrendChart,
    number,
} from '@/components/analytics/operational-charts';
import type { PostRow } from '@/components/analytics/post-performance-table';
import type { ReportWidget } from '@/components/analytics/report-widgets';
import { FeedbackToast } from '@/components/feedback-toast';
import { engagementPost } from '@/components/news-engagement';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import type { SharedData } from '@/types';

type QueueComment = {
    id: number;
    title: string;
    author: string;
    registered: boolean;
    content: string;
    status: string;
    revision: number;
    ai_flagged: boolean;
    flags?: string[];
    reports: number;
    created_at: string;
};
type Operational = {
    moderation: {
        pending: number;
        flagged: number;
        oldest_at: string | null;
        oldest_minutes: number | null;
        today: number;
        queue: QueueComment[];
        trend: { label: string; approved: number; rejected: number }[];
    };
    broadcast: ReportWidget;
    admin?: {
        drafts: number;
        active_readers: number;
        published: number;
        interactions: number;
        integrations: {
            platform: string;
            account: string;
            attention: boolean;
        }[];
        publications: { label: string; value: number }[];
        top_posts: PostRow[];
        recent: { name: string; to_status: string; created_at: string }[];
    };
};
const date = (value: string) => new Date(value).toLocaleString('id-ID');
export default function Dashboard({
    operational: data,
    period,
}: {
    operational: Operational;
    period: { from: string; to: string };
}) {
    const { auth } = usePage<SharedData>().props;
    const admin = auth.user?.role === 'admin' ? data.admin : undefined;
    const [busy, setBusy] = useState<number | null>(null);
    const lock = useRef(false);
    const [message, setMessage] = useState('');
    const [removing, setRemoving] = useState<number | null>(null);
    const [error, setError] = useState('');
    usePoll(30000, { only: ['operational'] });
    async function decide(comment: QueueComment, approve: boolean) {
        if (lock.current) {
            return;
        }

        lock.current = true;
        setBusy(comment.id);
        setError('');
        const action = approve ? 'allow' : 'hide';

        try {
            await engagementPost(`/admin/comments/${comment.id}/decision`, {
                action,
                expected_revision: comment.revision,
            });
            setMessage(
                approve
                    ? 'Komentar disetujui. Antrean diperbarui.'
                    : 'Komentar disembunyikan. Antrean diperbarui.',
            );
            setRemoving(comment.id);
            window.setTimeout(
                () =>
                    router.reload({
                        only: ['operational', 'moderationPendingCount'],
                        onFinish: () => {
                            lock.current = false;
                            setBusy(null);
                            setRemoving(null);
                        },
                    }),
                window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 0
                    : 180,
            );
        } catch (caught) {
            setError((caught as Error).message);
            lock.current = false;
            setBusy(null);
        }
    }
    const age = data.moderation.oldest_minutes;
    const recorded = data.broadcast.rows[1]?.value ?? 0,
        read = data.broadcast.rows[2]?.value ?? 0;

    return (
        <div className="analytics-redesign space-y-5 p-4 md:p-6">
            <Head title="Dasbor" />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {admin ? 'Dasbor Admin' : 'Meja Moderasi'}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {admin
                            ? 'Prioritas kerja dan kinerja komunitas'
                            : 'Tinjau komentar dan pantau pembacaan siaran'}{' '}
                        · {period.from} — {period.to}
                    </p>
                </div>
                <Badge variant="secondary">
                    {admin ? 'Admin' : 'Moderator'}
                </Badge>
            </div>
            {admin && (
                <>
                    <div className="grid gap-3 md:grid-cols-3">
                        {[
                            {
                                label: 'Draf Anda belum terbit',
                                value: admin.drafts,
                                href: '/admin/news?status=draft',
                            },
                            {
                                label: 'Komentar menunggu review',
                                value: data.moderation.pending,
                                href: '/admin/comments',
                            },
                            {
                                label: 'Integrasi perlu perhatian',
                                value: admin.integrations.filter(
                                    (c) => c.attention,
                                ).length,
                                href: '/admin/analytics?section=social',
                            },
                        ].map((a) => (
                            <Link
                                key={a.label}
                                href={a.href}
                                className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
                            >
                                <div className="text-sm text-muted-foreground">
                                    {a.label}
                                </div>
                                <div className="mt-1 text-2xl font-semibold tabular-nums">
                                    {number(a.value)}{' '}
                                    <span className="text-sm text-muted-foreground">
                                        →
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild>
                            <Link href="/admin/news/manual/create">
                                <Plus />
                                Tulis berita baru
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/admin/broadcasting/create">
                                <Radio />
                                Kirim pesan siaran
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/admin/documents">
                                <FolderUp />
                                Unggah dokumen
                            </Link>
                        </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric
                            label="Warga aktif · 30 hari"
                            value={admin.active_readers}
                            note="Akun warga unik dengan aktivitas tercatat; bukan penjumlahan views per artikel."
                        />
                        <Metric
                            label="Artikel aktif"
                            value={admin.published}
                            note="Total berita berstatus aktif saat ini."
                        />
                        <Metric
                            label="Interaksi warga · 30 hari"
                            value={admin.interactions}
                            note="Suka aktif dan komentar diterbitkan dari akun warga, berdasarkan tanggal pembuatan."
                        />
                        <Metric
                            label="Rasio baca siaran"
                            value={
                                recorded
                                    ? `${((read / recorded) * 100).toFixed(1)}%`
                                    : '—'
                            }
                            note={`${number(read)} dibaca dari ${number(recorded)} notifikasi tercatat untuk siaran periode ini.`}
                        />
                    </div>
                    <div className="grid items-start gap-4 xl:grid-cols-2">
                        <TrendChart
                            title="Tren berita aktif menurut tanggal dibuat"
                            rows={admin.publications}
                            series={[
                                {
                                    key: 'value',
                                    label: 'Berita',
                                    color: '#16a34a',
                                },
                            ]}
                            action={
                                <Link
                                    className="text-xs underline"
                                    href="/admin/analytics?section=posts"
                                >
                                    Detail kinerja →
                                </Link>
                            }
                        />
                        <TrendChart
                            title="Tercatat vs dibaca per siaran terbaru"
                            rows={(data.broadcast.recent ?? [])
                                .slice(0, 5)
                                .map((b, i) => ({
                                    label: `${i + 1}. ${b.title}`,
                                    recorded: b.recorded,
                                    read: b.read,
                                }))}
                            bars
                            series={[
                                {
                                    key: 'recorded',
                                    label: 'Tercatat',
                                    color: '#0d9488',
                                },
                                {
                                    key: 'read',
                                    label: 'Dibaca',
                                    color: '#16a34a',
                                },
                            ]}
                        />
                    </div>
                    <Card className="shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">
                                Berita terpopuler · kumulatif
                            </CardTitle>
                            <Button asChild variant="link">
                                <Link href="/admin/analytics?section=posts">
                                    Bandingkan →
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {admin.top_posts.length ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-left text-xs text-muted-foreground">
                                            <tr>
                                                <th className="py-2">Berita</th>
                                                <th>Tayangan</th>
                                                <th>Unik*</th>
                                                <th>Suka</th>
                                                <th>Komentar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {admin.top_posts.map((p) => (
                                                <tr
                                                    className="border-t"
                                                    key={p.id}
                                                >
                                                    <td className="py-3 pr-4">
                                                        <Link
                                                            href={`/admin/analytics?section=posts&post=${p.id}`}
                                                        >
                                                            {p.title}
                                                        </Link>
                                                        <div>
                                                            <Badge variant="secondary">
                                                                {p.category}
                                                            </Badge>
                                                        </div>
                                                    </td>
                                                    {[
                                                        p.views,
                                                        p.unique,
                                                        p.likes,
                                                        p.comments,
                                                    ].map((v, i) => (
                                                        <td
                                                            className="pr-4 tabular-nums"
                                                            key={i}
                                                        >
                                                            {number(v)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        *Identitas akun dan tamu; penghitung
                                        kumulatif, bukan jangkauan unik
                                        platform.
                                    </p>
                                </div>
                            ) : (
                                <Empty>Belum ada berita.</Empty>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle className="text-sm">
                                Aktivitas moderasi terbaru
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {admin.recent.length ? (
                                admin.recent.map((r, i) => (
                                    <div
                                        key={i}
                                        className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm last:border-0"
                                    >
                                        <span>
                                            {r.name ?? 'Sistem'} ·{' '}
                                            {r.to_status === 'published'
                                                ? 'Komentar diterbitkan'
                                                : 'Komentar ditolak / dihapus'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {r.created_at}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <Empty>Belum ada keputusan moderasi.</Empty>
                            )}
                            <p className="mt-3 text-xs text-muted-foreground">
                                Berdasarkan riwayat moderasi tersimpan; bukan
                                audit seluruh tindakan platform.
                            </p>
                        </CardContent>
                    </Card>
                </>
            )}
            {!admin && (
                <>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild>
                            <Link href="/admin/comments">Buka antrean</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/admin/comments?tab=history">
                                Riwayat keputusan
                            </Link>
                        </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric
                            label="Menunggu review"
                            value={data.moderation.pending}
                            note="Antrean saat ini, termasuk komentar dilaporkan."
                        />
                        <Metric
                            label="Ditandai AI / dilaporkan"
                            value={data.moderation.flagged}
                            note="Bagian dari antrean, bukan tambahan jumlah menunggu."
                        />
                        <Metric
                            label="Antrean tertua"
                            value={
                                age === null
                                    ? '—'
                                    : `${Math.floor(age / 60)}j ${age % 60}m`
                            }
                            note="Target peninjauan kurang dari 6 jam."
                        />
                        <Metric
                            label="Keputusan Anda hari ini"
                            value={data.moderation.today}
                            note="Tindakan moderasi oleh akun Anda pada hari ini."
                        />
                    </div>
                    {age !== null && age >= 360 && (
                        <Alert>
                            <AlertCircle />
                            <AlertDescription>
                                Antrean tertua telah melewati target 6 jam.
                                Prioritaskan peninjauan.
                            </AlertDescription>
                        </Alert>
                    )}
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle className="text-sm">
                                Antrean prioritas
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Ditandai AI, jumlah laporan, lalu waktu terlama.
                                Maksimal 5 komentar.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {data.moderation.queue.length ? (
                                data.moderation.queue.map((c) => (
                                    <article
                                        key={c.id}
                                        className={`space-y-3 rounded-lg border p-4 transition-all duration-150 motion-reduce:transition-none ${removing === c.id ? 'scale-95 opacity-0' : 'opacity-100'}`}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="text-sm font-medium">
                                                {c.author}{' '}
                                                <span className="font-normal text-muted-foreground">
                                                    ·{' '}
                                                    {c.registered
                                                        ? 'Warga terdaftar'
                                                        : 'Tamu'}
                                                </span>
                                            </div>
                                            <time className="text-xs text-muted-foreground">
                                                {date(c.created_at)}
                                            </time>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Pada: {c.title}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {c.ai_flagged && (
                                                <Badge variant="secondary">
                                                    Ditandai AI
                                                </Badge>
                                            )}
                                            {c.flags?.map((flag) => (
                                                <Badge
                                                    variant="secondary"
                                                    key={flag}
                                                >
                                                    {(
                                                        {
                                                            harassment:
                                                                'Pelecehan',
                                                            hate: 'Kebencian',
                                                            violence:
                                                                'Kekerasan',
                                                            sexual: 'Seksual',
                                                            'self-harm':
                                                                'Menyakiti diri',
                                                        } as Record<
                                                            string,
                                                            string
                                                        >
                                                    )[flag] ?? flag}
                                                </Badge>
                                            ))}
                                            {c.reports > 0 && (
                                                <Badge variant="destructive">
                                                    {c.reports} laporan belum
                                                    diselesaikan
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm break-words whitespace-pre-wrap">
                                            {c.content}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                disabled={busy !== null}
                                                onClick={() => decide(c, true)}
                                            >
                                                <Check />
                                                {c.status === 'published'
                                                    ? 'Pertahankan'
                                                    : 'Setujui'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={busy !== null}
                                                onClick={() => decide(c, false)}
                                            >
                                                <X />
                                                Sembunyikan
                                            </Button>
                                        </div>
                                    </article>
                                ))
                            ) : (
                                <Empty>Semua komentar sudah ditinjau.</Empty>
                            )}
                        </CardContent>
                    </Card>
                    <div className="grid items-start gap-4 xl:grid-cols-2">
                        <TrendChart
                            title="Keputusan Anda · 7 hari terakhir"
                            rows={data.moderation.trend}
                            bars
                            series={[
                                {
                                    key: 'approved',
                                    label: 'Diterbitkan / dipertahankan',
                                    color: '#16a34a',
                                },
                                {
                                    key: 'rejected',
                                    label: 'Disembunyikan / ditolak',
                                    color: '#ef4444',
                                },
                            ]}
                        />
                        <BroadcastPanel widget={data.broadcast} compact />
                    </div>
                </>
            )}
            <FeedbackToast
                feedback={message ? { variant: 'success', message } : null}
                onDismiss={() => setMessage('')}
            />
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
Dashboard.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={[{ title: 'Dasbor', href: '/admin/dashboard' }]}>
        {page}
    </AppLayout>
);
