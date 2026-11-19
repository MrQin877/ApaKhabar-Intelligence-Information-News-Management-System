import { Head, Link, router } from '@inertiajs/react';
import {
    Check,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Flag,
    Loader2,
    MessageSquare,
    RotateCcw,
    Search,
    ShieldAlert,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { engagementPost } from '@/components/news-engagement';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tabs,
    TabsList,
    TabsTrigger,
    tabsListVariants,
} from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';

interface History {
    id: number;
    moderator_id: number | null;
    moderator_name: string | null;
    from_status: string | null;
    to_status: string;
    action: string | null;
    reason: string | null;
    created_at: string;
}
interface Feedback {
    id: number;
    history_id: number;
    classification: string;
    category: string;
    explanation: string | null;
    administrator_name: string | null;
    created_at: string;
}
interface ManualFlag {
    id: number;
    category: string;
    explanation: string | null;
    moderator_name: string | null;
    created_at: string;
    resolved_at: string | null;
}
interface Entry {
    id: number;
    content_type?: 'news' | 'shorts';
    news_id: number | null;
    news: { id: number; title: string } | null;
    user: { id: number; name: string } | null;
    guest_name: string | null;
    content: string;
    status: string;
    revision: number;
    ai_flagged: boolean;
    categories: Record<string, boolean> | null;
    reason: string | null;
    created_at: string;
    reports: {
        id: number;
        reason: string;
        category: string | null;
        explanation: string | null;
        reporter_name: string | null;
        created_at: string;
        resolved_at: string | null;
    }[];
    history: History[];
    flags: ManualFlag[];
    feedback: Feedback[];
}
interface Filters {
    tab: 'pending' | 'history';
    source: string;
    decision: string;
    search: string;
    from: string;
    until: string;
    content_type?: 'news' | 'shorts';
}
interface Props {
    comments: {
        data: Entry[];
        current_page: number;
        last_page: number;
        total: number;
        from: number | null;
        to: number | null;
        prev_page_url: string | null;
        next_page_url: string | null;
    };
    counts: Record<string, number>;
    filters: Filters;
}
const sourceOptions = [
    { value: 'all', label: 'Semua' },
    { value: 'ai', label: 'Ditandai AI' },
    { value: 'reported', label: 'Dilaporkan' },
    { value: 'admin', label: 'Ditandai Admin' },
];
const moderationLabels: Record<string, string> = {
    submitted: 'Diajukan',
    manual_moderation: 'Diterbitkan; moderasi oleh admin',
    pending_review: 'Menunggu peninjauan',
    published: 'Diterbitkan',
    hidden: 'Disembunyikan',
    rejected: 'Ditolak',
    removed: 'Disembunyikan',
    ai_flagged: 'Ditandai AI',
    moderation_unavailable: 'Layanan moderasi tidak tersedia',
    suspicious_promotion_or_link: 'Terdeteksi promosi atau tautan mencurigakan',
    checks_passed: 'Lolos pemeriksaan',
    promotional_link: 'Tautan promosi',
    openai_service_unavailable: 'Layanan moderasi AI tidak tersedia',
    harassment: 'Pelecehan',
    profanity: 'Kata kasar / bahasa tidak pantas',
    threat: 'Ancaman / Intimidasi',
    other_harmful: 'Konten berbahaya lainnya',
    'harassment/threatening': 'Ancaman pelecehan',
    hate: 'Ujaran kebencian',
    'hate/threatening': 'Ancaman kebencian',
    illicit: 'Aktivitas ilegal',
    'illicit/violent': 'Aktivitas ilegal dengan kekerasan',
    'self-harm': 'Menyakiti diri sendiri',
    'self-harm/intent': 'Niat menyakiti diri sendiri',
    'self-harm/instructions': 'Petunjuk menyakiti diri sendiri',
    sexual: 'Konten seksual',
    'sexual/minors': 'Konten seksual terkait anak',
    violence: 'Kekerasan',
    'violence/graphic': 'Kekerasan eksplisit',
};

function moderationLabel(value: string): string {
    return moderationLabels[value] ?? value;
}

Object.assign(moderationLabels, {
    indirect_insult: 'Hinaan tidak langsung',
    threat_intimidation: 'Ancaman / Intimidasi',
    hate_speech: 'Ujaran kebencian',
    spam: 'Spam',
    other: 'Lainnya',
    harmless_criticism: 'Kritik wajar / salah deteksi AI',
});
function formatDate(value: string | null) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}
function author(comment: Entry) {
    return comment.user?.name ?? comment.guest_name ?? 'Tamu';
}
function Initials({ comment }: { comment: Entry }) {
    return (
        <Avatar className="size-10 shrink-0 rounded-xl">
            <AvatarFallback className="rounded-xl bg-muted text-sm">
                {author(comment)
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')
                    .toUpperCase()}
            </AvatarFallback>
        </Avatar>
    );
}
function sources(comment: Entry) {
    const labels = [];

    if (comment.ai_flagged) {
        labels.push('Ditandai AI');
    }

    if (comment.reports.length) {
        labels.push('Dilaporkan');
    }

    if (comment.flags.length) {
        labels.push('Ditandai Admin');
    }

    return labels.length ? labels.join(' \u00b7 ') : 'Pemeriksaan otomatis';
}
function decisionLabel(event?: History) {
    if (!event) {
        return 'Belum ditinjau';
    }

    if (
        event.reason?.startsWith('restore:') ||
        (event.action === 'allow' &&
            ['hidden', 'removed', 'rejected'].includes(event.from_status ?? ''))
    ) {
        return 'Dipulihkan';
    }

    return ['hidden', 'removed', 'rejected'].includes(event.to_status)
        ? 'Ditolak'
        : 'Disetujui';
}
function decisionNotes(event: History) {
    return (
        event.reason?.replace(
            /^(approve|reject|remove|restore|dismiss_reports):\s*/,
            '',
        ) ?? ''
    );
}

export default function Comments({ comments, filters, counts }: Props) {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected =
        comments.data.find((item) => item.id === selectedId) ?? null;
    const [search, setSearch] = useState(filters.search);
    const [from, setFrom] = useState(filters.from);
    const [until, setUntil] = useState(filters.until);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{
        error: boolean;
        text: string;
    } | null>(null);
    const detail = useRef<HTMLDivElement>(null);
    function visit(next: Partial<Filters> = {}, page = 1) {
        if (busy || loading) {
            return;
        }

        router.get(
            '/admin/comments',
            { ...filters, ...next, page },
            {
                preserveState: true,
                preserveScroll: true,
                onStart: () => setLoading(true),
                onSuccess: () => {
                    setSelectedId(null);
                    setNotice(null);
                },
                onError: () =>
                    setNotice({
                        error: true,
                        text: 'Filter tidak valid. Periksa tanggal dan coba lagi.',
                    }),
                onFinish: () => setLoading(false),
            },
        );
    }
    function refresh(message: string) {
        setNotice({ error: false, text: message });
        const page =
            filters.tab === 'pending' && comments.data.length === 1
                ? Math.max(1, comments.current_page - 1)
                : comments.current_page;
        router.get(
            '/admin/comments',
            { ...filters, page },
            {
                preserveState: true,
                preserveScroll: true,
                only: [
                    'comments',
                    'counts',
                    'filters',
                    'moderationPendingCount',
                ],
                onStart: () => setLoading(true),
                onFinish: () => {
                    setLoading(false);
                    setBusy(false);
                },
                onError: () =>
                    setNotice({
                        error: true,
                        text: 'Keputusan tersimpan, tetapi daftar gagal diperbarui. Muat ulang daftar.',
                    }),
            },
        );
    }

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Moderasi Komentar', href: '/admin/comments' },
            ]}
        >
            <Head title="Moderasi Komentar" />
            <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
                <header>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Moderasi Komentar
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {filters.tab === 'pending'
                            ? 'Tinjau komentar yang perlu keputusan admin.'
                            : 'Lihat keputusan moderasi yang telah diselesaikan.'}
                    </p>
                    <Link
                        href="/admin/comments/legacy-history"
                        className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                        Lihat arsip moderasi lama
                    </Link>
                </header>
                {notice && (
                    <Alert
                        variant={notice.error ? 'destructive' : 'default'}
                        role={notice.error ? 'alert' : 'status'}
                    >
                        <AlertDescription>{notice.text}</AlertDescription>
                    </Alert>
                )}
                <div
                    className={cn(
                        'grid min-w-0 items-start gap-6',
                        selected &&
                            'lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]',
                    )}
                >
                    <section
                        className="min-w-0 space-y-4"
                        aria-label="Daftar moderasi"
                        aria-busy={loading}
                    >
                        <Tabs
                            value={filters.tab}
                            onValueChange={(tab) =>
                                visit({
                                    tab: tab as Filters['tab'],
                                    source: 'all',
                                    decision: 'all',
                                })
                            }
                        >
                            <TabsList
                                aria-label="Tampilan moderasi"
                                className="max-w-full"
                            >
                                <TabsTrigger
                                    value="pending"
                                    disabled={busy || loading}
                                    className="data-[state=active]:border-primary data-[state=active]:ring-1 data-[state=active]:ring-primary/30 dark:data-[state=active]:border-primary"
                                >
                                    Perlu Ditinjau{' '}
                                    <span className="rounded-full bg-background px-2 text-xs tabular-nums">
                                        {counts.pending}
                                    </span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    disabled={busy || loading}
                                    className="data-[state=active]:border-primary data-[state=active]:ring-1 data-[state=active]:ring-primary/30 dark:data-[state=active]:border-primary"
                                >
                                    Riwayat
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <div className="flex gap-2" aria-label="Jenis konten">
                            {(
                                [
                                    ['news', 'Berita'],
                                    ['shorts', 'Video Pendek'],
                                ] as const
                            ).map(([value, label]) => (
                                <Button
                                    key={value}
                                    size="sm"
                                    variant={
                                        (filters.content_type ?? 'news') ===
                                        value
                                            ? 'secondary'
                                            : 'outline'
                                    }
                                    aria-pressed={
                                        (filters.content_type ?? 'news') ===
                                        value
                                    }
                                    disabled={busy || loading}
                                    onClick={() =>
                                        visit({
                                            content_type: value,
                                            source: 'all',
                                            decision: 'all',
                                        })
                                    }
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                        <form
                            className="space-y-3"
                            onSubmit={(event) => {
                                event.preventDefault();
                                visit({ search, from, until });
                            }}
                        >
                            <div className="flex gap-2">
                                <div className="relative min-w-0 flex-1">
                                    <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
                                    <Input
                                        aria-label="Cari komentar, pengguna, atau judul konten"
                                        placeholder="Cari komentar, pengguna, atau judul konten..."
                                        value={search}
                                        maxLength={200}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        className="pl-9"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    variant="outline"
                                    disabled={busy || loading}
                                >
                                    Cari
                                </Button>
                            </div>
                            {filters.tab === 'history' && (
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="decision-filter">
                                            Status keputusan
                                        </Label>
                                        <Select
                                            value={filters.decision}
                                            onValueChange={(decision) =>
                                                visit({ decision })
                                            }
                                            disabled={busy || loading}
                                        >
                                            <SelectTrigger
                                                id="decision-filter"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    Semua Status
                                                </SelectItem>
                                                <SelectItem value="approved">
                                                    Disetujui
                                                </SelectItem>
                                                <SelectItem value="rejected">
                                                    Ditolak
                                                </SelectItem>
                                                <SelectItem value="restored">
                                                    Dipulihkan
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="from-date">
                                            Dari tanggal
                                        </Label>
                                        <Input
                                            id="from-date"
                                            type="date"
                                            value={from}
                                            max={until || undefined}
                                            onChange={(event) =>
                                                setFrom(event.target.value)
                                            }
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="until-date">
                                            Sampai tanggal
                                        </Label>
                                        <Input
                                            id="until-date"
                                            type="date"
                                            value={until}
                                            min={from || undefined}
                                            onChange={(event) =>
                                                setUntil(event.target.value)
                                            }
                                        />
                                    </div>
                                    <div className="flex gap-2 sm:col-span-3">
                                        <Button
                                            type="submit"
                                            variant="outline"
                                            size="sm"
                                            disabled={busy || loading}
                                        >
                                            Terapkan Filter
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            disabled={busy || loading}
                                            onClick={() => {
                                                setSearch('');
                                                setFrom('');
                                                setUntil('');
                                                visit({
                                                    search: '',
                                                    from: '',
                                                    until: '',
                                                    decision: 'all',
                                                });
                                            }}
                                        >
                                            Atur Ulang
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </form>
                        {filters.tab === 'pending' && (
                            <div
                                className={cn(
                                    tabsListVariants(),
                                    'h-auto max-w-full flex-wrap justify-start gap-1',
                                )}
                                role="group"
                                aria-label="Sumber moderasi"
                            >
                                {sourceOptions.map((source) => (
                                    <Button
                                        key={source.value}
                                        size="sm"
                                        variant="ghost"
                                        aria-pressed={
                                            filters.source === source.value
                                        }
                                        className="h-8 rounded-md border border-transparent px-3 aria-pressed:border-neutral-300/70 aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-xs dark:aria-pressed:border-neutral-600 dark:aria-pressed:bg-neutral-700"
                                        disabled={busy || loading}
                                        onClick={() =>
                                            visit({ source: source.value })
                                        }
                                    >
                                        {source.label}
                                        <span className="text-xs text-muted-foreground">
                                            {counts[source.value]}
                                        </span>
                                    </Button>
                                ))}
                            </div>
                        )}
                        {loading && (
                            <p
                                role="status"
                                className="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                                <Loader2 className="size-4 animate-spin" />
                                Memuat komentar...
                            </p>
                        )}
                        {!comments.data.length ? (
                            <div className="rounded-xl border border-dashed p-10 text-center">
                                <MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground" />
                                <h2 className="font-medium">
                                    {filters.tab === 'pending'
                                        ? 'Tidak ada komentar untuk ditinjau'
                                        : 'Tidak ada riwayat ditemukan'}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {filters.search ||
                                    filters.source !== 'all' ||
                                    filters.decision !== 'all' ||
                                    filters.from ||
                                    filters.until
                                        ? 'Coba ubah pencarian atau filter.'
                                        : 'Komentar akan muncul di sini ketika tersedia.'}
                                </p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {comments.data.map((comment) => (
                                    <li key={comment.id}>
                                        <button
                                            type="button"
                                            disabled={busy || loading}
                                            aria-pressed={
                                                selected?.id === comment.id
                                            }
                                            onClick={() => {
                                                setSelectedId(comment.id);

                                                if (
                                                    window.matchMedia(
                                                        '(max-width: 1023px)',
                                                    ).matches
                                                ) {
                                                    requestAnimationFrame(() =>
                                                        detail.current?.scrollIntoView(
                                                            {
                                                                behavior:
                                                                    'smooth',
                                                                block: 'start',
                                                            },
                                                        ),
                                                    );
                                                }
                                            }}
                                            className={cn(
                                                'flex w-full gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60',
                                                selected?.id === comment.id &&
                                                    'border-primary bg-accent/40 ring-1 ring-primary/30',
                                            )}
                                        >
                                            <Initials comment={comment} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="truncate text-sm font-semibold">
                                                        {author(comment)}
                                                    </span>
                                                    {comment.content_type ===
                                                        'shorts' && (
                                                        <Badge variant="outline">
                                                            Video Pendek
                                                        </Badge>
                                                    )}
                                                    {filters.tab ===
                                                        'history' && (
                                                        <Badge
                                                            variant={
                                                                [
                                                                    'hidden',
                                                                    'removed',
                                                                    'rejected',
                                                                ].includes(
                                                                    comment.status,
                                                                )
                                                                    ? 'destructive'
                                                                    : 'secondary'
                                                            }
                                                        >
                                                            {decisionLabel(
                                                                comment.history.find(
                                                                    (event) =>
                                                                        event.moderator_id !==
                                                                        null,
                                                                ),
                                                            )}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="mt-1 line-clamp-2 text-sm break-words">
                                                    {comment.content}
                                                </p>
                                                <p className="mt-2 truncate text-xs text-muted-foreground">
                                                    {comment.news?.title ??
                                                        'Konten tidak tersedia'}
                                                </p>
                                                <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    <span>
                                                        {sources(comment)}
                                                    </span>
                                                    <time>
                                                        {formatDate(
                                                            filters.tab ===
                                                                'history'
                                                                ? comment
                                                                      .history[0]
                                                                      ?.created_at
                                                                : comment.created_at,
                                                        )}
                                                    </time>
                                                </div>
                                            </div>
                                            <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
                            <span>
                                {comments.from ?? 0}-{comments.to ?? 0} dari{' '}
                                {comments.total} komentar
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="icon"
                                    variant="outline"
                                    aria-label="Halaman sebelumnya"
                                    disabled={
                                        !comments.prev_page_url ||
                                        busy ||
                                        loading
                                    }
                                    onClick={() =>
                                        visit({}, comments.current_page - 1)
                                    }
                                >
                                    <ChevronLeft />
                                </Button>
                                <span>
                                    {comments.current_page} /{' '}
                                    {comments.last_page}
                                </span>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    aria-label="Halaman berikutnya"
                                    disabled={
                                        !comments.next_page_url ||
                                        busy ||
                                        loading
                                    }
                                    onClick={() =>
                                        visit({}, comments.current_page + 1)
                                    }
                                >
                                    <ChevronRight />
                                </Button>
                            </div>
                        </div>
                    </section>
                    {selected && (
                        <div
                            ref={detail}
                            className="min-w-0 scroll-mt-4 lg:sticky lg:top-4"
                        >
                            <CommentDetails
                                key={`${selected.id}-${selected.revision}`}
                                comment={selected}
                                pending={filters.tab === 'pending'}
                                busy={busy || loading}
                                onBusy={setBusy}
                                onClose={() => setSelectedId(null)}
                                onSuccess={refresh}
                            />
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

const greenButton =
    'border border-green-600 bg-green-700 text-white enabled:hover:border-green-700 enabled:hover:bg-green-800 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:border-gray-700 dark:disabled:bg-gray-700 dark:disabled:text-gray-400';

function CommentDetails({
    comment,
    pending,
    busy,
    onBusy,
    onClose,
    onSuccess,
}: {
    comment: Entry;
    pending: boolean;
    busy: boolean;
    onBusy: (value: boolean) => void;
    onClose: () => void;
    onSuccess: (message: string) => void;
}) {
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const [confirmation, setConfirmation] = useState<
        'approve' | 'reject' | 'restore' | null
    >(null);
    const submitting = useRef(false);
    const latest = comment.history.find((event) => event.moderator_id !== null);
    const categories = Object.entries(comment.categories ?? {})
        .filter(([, active]) => active)
        .map(([key]) => moderationLabel(key));
    async function decide(intent: 'approve' | 'reject' | 'restore') {
        if (submitting.current || busy) {
            return;
        }

        submitting.current = true;
        onBusy(true);
        setError('');
        const action = intent === 'reject' ? 'hide' : 'allow';

        try {
            const result = await engagementPost(
                `/admin/comments/${comment.id}/decision`,
                {
                    action,
                    reason: notes.trim() || undefined,
                    expected_revision: comment.revision,
                    content_type: comment.content_type ?? 'news',
                },
            );
            setConfirmation(null);
            onSuccess(result.message);
        } catch (caught) {
            setError((caught as Error).message);
            onBusy(false);
            setConfirmation(null);
        } finally {
            submitting.current = false;
        }
    }
    const timeline = [
        ...comment.history.map((event) => {
            const correction = comment.feedback.find(
                (item) => item.history_id === event.id,
            );

            return {
                key: `history-${event.id}`,
                date: event.created_at,
                title: correction
                    ? `Koreksi admin oleh ${correction.administrator_name ?? 'Admin'}`
                    : event.moderator_id
                      ? `${decisionLabel(event)} oleh ${event.moderator_name ?? 'Moderator'}`
                      : 'Pemeriksaan otomatis',
                text: correction
                    ? `${moderationLabel(correction.category)}${correction.explanation ? ': ' + correction.explanation : ''}`
                    : event.moderator_id
                      ? decisionNotes(event)
                      : moderationLabel(event.reason ?? 'submitted'),
            };
        }),
        ...comment.reports.map((report) => ({
            key: `report-${report.id}`,
            date: report.created_at,
            title: `Dilaporkan oleh ${report.reporter_name ?? 'Pengguna'}`,
            text: `${report.category ?? 'Lainnya'}${report.explanation ? ': ' + report.explanation : ''}`,
        })),
        ...comment.flags.map((flag) => ({
            key: `flag-${flag.id}`,
            date: flag.created_at,
            title: `Ditandai oleh ${flag.moderator_name ?? 'Moderator'}`,
            text: `${moderationLabel(flag.category)}${flag.explanation ? ': ' + flag.explanation : ''}`,
        })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
        <section
            className="overflow-hidden rounded-xl border bg-card"
            aria-label="Detail komentar"
        >
            <div className="flex items-center justify-between border-b px-5 py-4">
                <h2 className="font-semibold">
                    {pending ? 'Detail Komentar' : 'Riwayat Keputusan'}
                </h2>
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Tutup detail"
                    disabled={busy}
                    onClick={onClose}
                >
                    <X className="size-4" />
                </Button>
            </div>
            <div className="space-y-5 p-5">
                <div className="flex items-center gap-3">
                    <Initials comment={comment} />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold break-words">
                            {author(comment)}
                            {!comment.user && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    Tamu
                                </span>
                            )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(comment.created_at)}
                        </p>
                    </div>
                </div>
                <div>
                    <h3 className="mb-2 text-sm font-medium">Komentar asli</h3>
                    <blockquote className="rounded-lg border bg-muted/30 p-3 text-sm break-words whitespace-pre-wrap">
                        {comment.content}
                    </blockquote>
                </div>
                <div>
                    <h3 className="mb-2 text-sm font-medium">
                        {comment.content_type === 'shorts'
                            ? 'Video terkait'
                            : 'Berita terkait'}
                    </h3>
                    {comment.news ? (
                        <Link
                            href={
                                comment.content_type === 'shorts'
                                    ? `/shorts/${comment.news.id}`
                                    : `/news/${comment.news.id}`
                            }
                            className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-accent"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <span className="min-w-0 break-words">
                                {comment.news.title}
                            </span>
                            <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <span className="sr-only">
                                Buka konten di tab baru
                            </span>
                        </Link>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Konten tidak tersedia.
                        </p>
                    )}
                </div>
                <div className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold">
                        Ringkasan moderasi
                    </h3>
                    <dl className="space-y-3 text-sm">
                        <div className="space-y-1">
                            <dt className="text-muted-foreground">Sumber</dt>
                            <dd>{sources(comment)}</dd>
                        </div>
                        {categories.length > 0 && (
                            <div className="space-y-1">
                                <dt className="flex items-center gap-2 text-muted-foreground">
                                    <ShieldAlert className="size-4" />
                                    Kategori AI
                                </dt>
                                <dd>{categories.join(', ')}</dd>
                            </div>
                        )}
                        {comment.reason && (
                            <div className="space-y-1">
                                <dt className="text-muted-foreground">
                                    Alasan pemeriksaan
                                </dt>
                                <dd>{moderationLabel(comment.reason)}</dd>
                            </div>
                        )}
                        {!pending && latest && (
                            <>
                                <div className="space-y-1">
                                    <dt className="text-muted-foreground">
                                        Keputusan terakhir
                                    </dt>
                                    <dd>
                                        {decisionLabel(latest)} oleh{' '}
                                        {latest.moderator_name ?? 'Moderator'}
                                        <span className="block text-xs text-muted-foreground">
                                            {formatDate(latest.created_at)}
                                        </span>
                                    </dd>
                                </div>
                                <div className="space-y-1">
                                    <dt className="text-muted-foreground">
                                        Catatan admin
                                    </dt>
                                    <dd className="break-words whitespace-pre-wrap">
                                        {decisionNotes(latest)}
                                    </dd>
                                </div>
                            </>
                        )}
                    </dl>
                </div>
                {pending &&
                    comment.reports.some((report) => !report.resolved_at) && (
                        <div className="space-y-2">
                            <h3 className="flex items-center gap-2 text-sm font-medium">
                                <Flag className="size-4" />
                                Laporan pengguna
                            </h3>
                            {comment.reports
                                .filter((report) => !report.resolved_at)
                                .map((report) => (
                                    <p
                                        key={report.id}
                                        className="rounded-lg bg-muted/40 p-3 text-sm break-words"
                                    >
                                        {report.category ?? 'Lainnya'}
                                        {report.explanation
                                            ? `: ${report.explanation}`
                                            : ''}{' '}
                                        · {report.reporter_name ?? 'Pengguna'} ·{' '}
                                        {formatDate(report.created_at)}
                                    </p>
                                ))}
                        </div>
                    )}
                {pending && comment.flags.some((flag) => !flag.resolved_at) && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium">
                            Tanda admin / moderator
                        </h3>
                        {comment.flags
                            .filter((flag) => !flag.resolved_at)
                            .map((item) => (
                                <div
                                    key={item.id}
                                    className="rounded-lg bg-muted/40 p-3 text-sm"
                                >
                                    <p>{moderationLabel(item.category)}</p>
                                    {item.explanation && (
                                        <p className="mt-1 break-words whitespace-pre-wrap">
                                            {item.explanation}
                                        </p>
                                    )}
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {item.moderator_name ?? 'Moderator'}{' '}
                                        &middot; {formatDate(item.created_at)}{' '}
                                        &middot; Status:{' '}
                                        {moderationLabel(comment.status)}
                                    </p>
                                </div>
                            ))}
                    </div>
                )}
                {!pending && (
                    <div className="border-t pt-4">
                        <h3 className="mb-4 text-sm font-semibold">
                            Linimasa tindakan
                        </h3>
                        <ol className="ml-1 space-y-4 border-l pl-4">
                            {timeline.map((event) => (
                                <li key={event.key} className="relative">
                                    <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary" />
                                    <p className="text-xs text-muted-foreground">
                                        {formatDate(event.date)}
                                    </p>
                                    <p className="mt-1 text-sm font-medium">
                                        {event.title}
                                    </p>
                                    <p className="mt-1 text-sm break-words whitespace-pre-wrap text-muted-foreground">
                                        {event.text}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
                {(pending ||
                    ['hidden', 'removed', 'rejected'].includes(
                        comment.status,
                    )) && (
                    <div className="space-y-3 border-t pt-4">
                        <Label htmlFor="decision-notes">
                            Catatan keputusan (opsional)
                        </Label>
                        <Textarea
                            id="decision-notes"
                            placeholder="Tambahkan catatan untuk riwayat moderasi..."
                            maxLength={500}
                            rows={3}
                            value={notes}
                            disabled={busy}
                            onChange={(event) => setNotes(event.target.value)}
                        />
                        <p className="text-right text-xs text-muted-foreground">
                            {notes.length}/500
                        </p>
                        {pending ? (
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="destructive"
                                    disabled={busy}
                                    onClick={() => setConfirmation('reject')}
                                >
                                    <X className="size-4" />
                                    Sembunyikan
                                </Button>
                                <Button
                                    disabled={busy}
                                    className={greenButton}
                                    onClick={() => setConfirmation('approve')}
                                >
                                    {busy ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Check className="size-4" />
                                    )}
                                    Izinkan
                                </Button>
                            </div>
                        ) : (
                            <Button
                                className="w-full"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setConfirmation('restore')}
                            >
                                <RotateCcw className="size-4" />
                                Pulihkan Komentar
                            </Button>
                        )}
                    </div>
                )}
                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription className="space-y-2">
                            <p>{error}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    router.reload({
                                        only: [
                                            'comments',
                                            'counts',
                                            'moderationPendingCount',
                                        ],
                                    })
                                }
                            >
                                Muat Ulang Daftar
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                {busy && (
                    <p role="status" className="text-sm text-muted-foreground">
                        Memproses, mohon tunggu...
                    </p>
                )}
            </div>
            <Dialog
                open={confirmation !== null}
                onOpenChange={(open) => {
                    if (!open && !busy) {
                        setConfirmation(null);
                    }
                }}
            >
                <DialogContent closeDisabled={busy}>
                    <DialogHeader>
                        <DialogTitle>
                            {confirmation === 'restore'
                                ? 'Pulihkan Komentar?'
                                : confirmation === 'approve'
                                  ? 'Izinkan Komentar?'
                                  : 'Sembunyikan Komentar?'}
                        </DialogTitle>
                        <DialogDescription>
                            {confirmation === 'reject'
                                ? 'Komentar akan disembunyikan dari publik. Komentar asli dan riwayat tetap disimpan.'
                                : 'Komentar akan terlihat oleh publik jika berita dan komentar induknya tersedia. Keputusan Anda akan dicatat dalam riwayat.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setConfirmation(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            className={greenButton}
                            disabled={busy}
                            onClick={() => {
                                if (confirmation) {
                                    void decide(confirmation);
                                }
                            }}
                        >
                            {busy
                                ? 'Memproses...'
                                : confirmation === 'restore'
                                  ? 'Pulihkan Komentar'
                                  : confirmation === 'approve'
                                    ? 'Izinkan Komentar'
                                    : 'Sembunyikan Komentar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
