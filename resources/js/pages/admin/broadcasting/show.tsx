import { Head, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Send,
    Archive,
    ArchiveRestore,
    Clock,
    Users,
    User,
    MessageSquare,
    Smartphone,
    Radio,
    CalendarDays,
    CheckCheck,
    AlertTriangle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

// ── Types ──────────────────────────────────────────────────
export type BroadcastDetail = {
    id: string;
    title: string;
    message: string;
    category: 'pengumuman' | 'darurat';
    channels: string[];
    audience: 'semua' | 'karyawan';
    status: 'dikirim' | 'terjadwal' | 'tertunda';
    send_mode: 'now' | 'scheduled';
    scheduled_at: string | null;
    sent_at: string | null;
    archived_at: string | null;
    created_at: string;
    creator: { id: string | null; name: string };
    stats: null | {
        total_sent: number;
        total_read: number;
        read_rate: number;
    };
};

type Props = {
    broadcast: BroadcastDetail;
};

// ── Helpers ────────────────────────────────────────────────
const statusMap = {
    dikirim: {
        label: 'Dikirim',
        className: 'bg-success-bg text-success-text border-success-border',
        dot: 'bg-brand-500',
    },
    terjadwal: {
        label: 'Terjadwal',
        className: 'bg-warning-bg text-warning-text border-warning-border',
        dot: 'bg-warning-500',
    },
    tertunda: {
        label: 'Tertunda',
        className: 'bg-danger-bg text-danger-text border-danger-border',
        dot: 'bg-danger-500',
    },
};

const channelMap: Record<string, { icon: React.ReactNode; label: string }> = {
    whatsapp: {
        icon: <MessageSquare className="h-4 w-4" />,
        label: 'WhatsApp',
    },
    sms: { icon: <Smartphone className="h-4 w-4" />, label: 'SMS' },
    aplikasi: { icon: <Radio className="h-4 w-4" />, label: 'Aplikasi' },
};

// ── Main Page ──────────────────────────────────────────────
export default function BroadcastShowPage({ broadcast }: Props) {
    const [loading, setLoading] = useState(false);

    // ← Listen to Inertia navigation events
    useEffect(() => {
        const startLoading = router.on('start', () => setLoading(true));
        const stopLoading = router.on('finish', () => setLoading(false));

        return () => {
            startLoading();
            stopLoading();
        };
    }, []);

    const status = statusMap[broadcast.status];
    const isDarurat = broadcast.category === 'darurat';
    const canResend = broadcast.status === 'dikirim';
    const canEdit =
        broadcast.status === 'tertunda' || broadcast.status === 'terjadwal';
    const isArchived = !!broadcast.archived_at;

    function handleResend() {
        router.post(
            `/admin/broadcasting/${broadcast.id}/resend`,
            {},
            {
                preserveScroll: true,
            },
        );
    }

    function handleArchive() {
        router.post(
            `/admin/broadcasting/${broadcast.id}/archive`,
            {},
            {
                onSuccess: () => router.visit('/admin/broadcasting'),
            },
        );
    }

    function handleRestore() {
        router.post(
            `/admin/broadcasting/${broadcast.id}/restore`,
            {},
            {
                preserveScroll: true,
            },
        );
    }

    return (
        <>
            <Head title={broadcast.title} />
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-6">
                {/* ── Top bar ── */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            router.visit(
                                isArchived
                                    ? '/admin/broadcasting/archived'
                                    : '/admin/broadcasting',
                            )
                        }
                        className="-ml-2 gap-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {isArchived ? 'Kembali ke Arsip' : 'Kembali ke Daftar'}
                    </Button>

                    <div className="flex items-center gap-2">
                        {canResend && !isArchived && (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={loading}
                                onClick={handleResend}
                                className="gap-1.5 text-sm"
                            >
                                <Send className="h-3.5 w-3.5" />
                                Kirim Ulang
                            </Button>
                        )}

                        {canEdit && !isArchived && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    router.visit(
                                        `/admin/broadcasting/${broadcast.id}/edit`,
                                    )
                                }
                                className="gap-1.5 text-sm"
                            >
                                Edit
                            </Button>
                        )}

                        {!isArchived ? (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5 text-sm text-neutral-600"
                                    >
                                        <Archive className="h-3.5 w-3.5" />
                                        Arsipkan
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Arsipkan siaran ini?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Siaran yang diarsipkan tidak akan
                                            ditampilkan dalam senarai utama,
                                            tetapi masih boleh dipulihkan dari
                                            halaman Arsip.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Batal
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            disabled={loading}
                                            onClick={handleArchive}
                                            className="bg-neutral-700 text-white hover:bg-neutral-800"
                                        >
                                            <Archive className="mr-1.5 h-3.5 w-3.5" />
                                            Ya, Arsipkan
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={loading}
                                onClick={handleRestore}
                                className="gap-1.5 text-sm text-green-600"
                            >
                                <ArchiveRestore className="size-4" />
                                Pulihkan
                            </Button>
                        )}
                    </div>
                </div>

                <section className="rounded-lg border bg-muted/30 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-lg leading-snug font-semibold break-words">
                                {broadcast.title}
                            </h1>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Dibuat oleh {broadcast.creator.name} ·{' '}
                                {broadcast.created_at}
                            </p>
                        </div>
                        {isArchived && (
                            <Badge variant="secondary">Diarsipkan</Badge>
                        )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Badge
                            variant="outline"
                            className={
                                isDarurat
                                    ? 'border-red-200 text-red-600 dark:border-red-900 dark:text-red-400'
                                    : ''
                            }
                        >
                            {isDarurat && <AlertTriangle className="size-3" />}
                            {isDarurat ? 'Darurat' : 'Pengumuman'}
                        </Badge>
                        <Badge variant="outline" className={status.className}>
                            <span
                                className={cn(
                                    'size-1.5 rounded-full',
                                    status.dot,
                                )}
                            />
                            {status.label}
                        </Badge>
                    </div>
                </section>
                <section aria-labelledby="message-heading">
                    <h2
                        id="message-heading"
                        className="mb-3 text-sm font-semibold"
                    >
                        Isi pesan
                    </h2>
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                        {broadcast.message}
                    </p>
                </section>
                <section aria-labelledby="delivery-heading">
                    <h2
                        id="delivery-heading"
                        className="mb-4 text-sm font-semibold"
                    >
                        Informasi pengiriman
                    </h2>
                    <dl className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="mb-1.5 text-xs text-muted-foreground">
                                Penerima
                            </dt>
                            <dd className="flex items-center gap-2">
                                {broadcast.audience === 'semua' ? (
                                    <Users className="size-4 text-muted-foreground" />
                                ) : (
                                    <User className="size-4 text-muted-foreground" />
                                )}
                                {broadcast.audience === 'semua'
                                    ? 'Semua Pengguna'
                                    : 'Karyawan'}
                            </dd>
                        </div>
                        <div>
                            <dt className="mb-1.5 text-xs text-muted-foreground">
                                Saluran
                            </dt>
                            <dd className="flex flex-wrap gap-2">
                                {broadcast.channels.length === 0
                                    ? '—'
                                    : broadcast.channels.map((ch) => (
                                          <Badge
                                              key={ch}
                                              variant="outline"
                                              className="gap-1.5 py-1 font-normal"
                                          >
                                              {channelMap[ch]?.icon}
                                              {channelMap[ch]?.label ?? ch}
                                          </Badge>
                                      ))}
                            </dd>
                        </div>
                        <div>
                            <dt className="mb-1.5 text-xs text-muted-foreground">
                                {!broadcast.sent_at &&
                                broadcast.send_mode === 'scheduled'
                                    ? 'Dijadwalkan'
                                    : 'Waktu terkirim'}
                            </dt>
                            <dd className="flex items-center gap-2">
                                {!broadcast.sent_at &&
                                broadcast.send_mode === 'scheduled' ? (
                                    <>
                                        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                                        {broadcast.scheduled_at ?? '—'}
                                    </>
                                ) : (
                                    <>
                                        <Clock className="size-4 shrink-0 text-muted-foreground" />
                                        {broadcast.sent_at ?? '—'}
                                    </>
                                )}
                            </dd>
                        </div>
                        {isArchived && (
                            <div>
                                <dt className="mb-1.5 text-xs text-muted-foreground">
                                    Diarsipkan
                                </dt>
                                <dd className="flex items-center gap-2">
                                    <Archive className="size-4 shrink-0 text-muted-foreground" />
                                    {broadcast.archived_at}
                                </dd>
                            </div>
                        )}
                    </dl>
                </section>
                <Separator />
                {broadcast.stats && (
                    <section aria-labelledby="stats-heading">
                        <h2
                            id="stats-heading"
                            className="mb-3 text-sm font-semibold"
                        >
                            Statistik pengiriman
                        </h2>
                        <div className="rounded-lg border p-4 sm:p-5">
                            <dl className="grid grid-cols-2 gap-4">
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Total terkirim
                                    </dt>
                                    <dd className="mt-1 text-sm font-medium tabular-nums">
                                        {broadcast.stats.total_sent}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Telah dibaca
                                    </dt>
                                    <dd className="mt-1 text-sm font-medium tabular-nums">
                                        {broadcast.stats.total_read}
                                    </dd>
                                </div>
                            </dl>
                            {broadcast.stats.total_sent > 0 && (
                                <div className="mt-5">
                                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1.5">
                                            <CheckCheck className="size-3.5 shrink-0" />
                                            Rate diakses keseluruhan
                                        </span>
                                        <span>
                                            {broadcast.stats.read_rate}%
                                        </span>
                                    </div>
                                    <div
                                        role="progressbar"
                                        aria-label="Rate diakses keseluruhan"
                                        aria-valuenow={
                                            broadcast.stats.read_rate
                                        }
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        className="h-2 overflow-hidden rounded-full bg-muted"
                                    >
                                        <div
                                            className="h-full rounded-full bg-green-500"
                                            style={{
                                                width: `${Math.min(100, Math.max(0, broadcast.stats.read_rate))}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}
                {isArchived && (
                    <p className="text-xs text-muted-foreground">
                        Pulihkan mengembalikan pesan ke Semua Pesan tanpa
                        mengirim ulang.
                    </p>
                )}
            </div>
        </>
    );
}

BroadcastShowPage.layout = (page: React.ReactElement) => {
    const { broadcast } = page.props as Props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Pesan', href: '/admin/broadcasting' },
        ...(broadcast.archived_at
            ? [{ title: 'Arsip', href: '/admin/broadcasting/archived' }]
            : []),
        { title: broadcast.title, href: '#' },
    ];

    return <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>;
};
