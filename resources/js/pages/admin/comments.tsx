import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowUpDown,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    ExternalLink,
    Flag,
    MessageSquare,
    Newspaper,
    RefreshCw,
    Search,
    Shield,
    ShieldAlert,
    Trash2,
    User as UserIcon,
    X,
    XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { engagementPost } from '@/components/news-engagement';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface NewsInfo {
    id: number;
    title: string;
    image: string | null;
    created_at: string | null;
    created_by?: number | null;
}

interface UserInfo {
    id: number;
    name: string;
}

interface CommentReport {
    id: number;
    user_id: number;
    reporter_name?: string | null;
    reason: string;
    created_at: string;
    resolved_at: string | null;
}

interface CommentHistory {
    id: number;
    moderator_id: number | null;
    moderator_name?: string | null;
    from_status: string;
    to_status: string;
    reason: string;
    created_at: string;
}

interface Entry {
    id: number;
    news_id: number;
    news?: NewsInfo | null;
    user_id: number | null;
    user?: UserInfo | null;
    guest_name: string | null;
    content: string;
    status: string;
    reason: string | null;
    ai_flagged: boolean | null;
    categories: Record<string, boolean> | null;
    created_at: string;
    reports: CommentReport[];
    history: CommentHistory[];
}

interface TabCounts {
    all: number;
    pending_review: number;
    reported: number;
    published: number;
    rejected: number;
    removed: number;
}

interface CommentsPageProps {
    comments: {
        data: Entry[];
        current_page?: number;
        last_page?: number;
        total?: number;
        prev_page_url: string | null;
        next_page_url: string | null;
    };
    status: string;
    counts?: TabCounts;
    filters?: {
        status: string;
        search: string;
        sort: string;
    };
    analytics?: {
        total_views: number;
        unique_views: number;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Moderasi Komentar',
        href: '/admin/comments',
    },
];

const moderationLabels: Record<string, string> = {
    submitted: 'Diajukan',
    pending_review: 'Menunggu peninjauan',
    published: 'Diterbitkan',
    rejected: 'Ditolak',
    removed: 'Dihapus',
    ai_flagged: 'Ditandai AI',
    moderation_unavailable: 'Layanan moderasi tidak tersedia',
    suspicious_promotion_or_link: 'Terdeteksi promosi atau tautan mencurigakan',
    checks_passed: 'Lolos pemeriksaan',
    promotional_link: 'Tautan promosi',
    openai_service_unavailable: 'Layanan moderasi AI tidak tersedia',
    harassment: 'Pelecehan',
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

function formatDate(dateString?: string | null): string {
    if (!dateString) {
        return '—';
    }

    try {
        const d = new Date(dateString);

        if (Number.isNaN(d.getTime())) {
            return dateString;
        }

        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(d);
    } catch {
        return dateString;
    }
}

function getInitials(name?: string | null): string {
    if (!name) {
        return '?';
    }

    return name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

export default function Comments({
    comments,
    status = 'all',
    counts,
    filters,
}: CommentsPageProps) {
    const [selectedCommentId, setSelectedCommentId] = useState<number | null>(
        null,
    );
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<{
        type: 'success' | 'error';
        text: string;
    } | null>(null);
    const [decisionReason, setDecisionReason] = useState('');
    const [searchQuery, setSearchQuery] = useState(filters?.search ?? '');
    const [currentSort, setCurrentSort] = useState(filters?.sort ?? 'newest');

    // Confirm dialog state for destructive decisions
    const [confirmAction, setConfirmAction] = useState<{
        action: string;
        title: string;
        description: string;
    } | null>(null);

    // Keep active selection in sync when list updates
    useEffect(() => {
        if (comments.data.length > 0) {
            if (
                selectedCommentId === null ||
                !comments.data.some((c) => c.id === selectedCommentId)
            ) {
                setSelectedCommentId(comments.data[0].id);
            }
        } else {
            setSelectedCommentId(null);
        }
    }, [comments.data, selectedCommentId]);

    const selectedComment = useMemo(
        () => comments.data.find((c) => c.id === selectedCommentId) ?? null,
        [comments.data, selectedCommentId],
    );

    // Tab counts from backend or fallback to data length
    const tabCounts = counts ?? {
        all: comments.total ?? comments.data.length,
        pending_review: 0,
        reported: 0,
        published: 0,
        rejected: 0,
        removed: 0,
    };

    const tabs = [
        { key: 'all', label: 'Semua', count: tabCounts.all, icon: null },
        {
            key: 'pending_review',
            label: 'Menunggu Peninjauan',
            count: tabCounts.pending_review,
            icon: Clock,
        },
        {
            key: 'reported',
            label: 'Dilaporkan',
            count: tabCounts.reported,
            icon: AlertTriangle,
        },
        {
            key: 'published',
            label: 'Disetujui',
            count: tabCounts.published,
            icon: CheckCircle2,
        },
        {
            key: 'rejected',
            label: 'Ditolak',
            count: tabCounts.rejected,
            icon: XCircle,
        },
        {
            key: 'removed',
            label: 'Dihapus',
            count: tabCounts.removed,
            icon: Trash2,
        },
    ];

    function handleTabClick(tabKey: string) {
        router.get(
            '/admin/comments',
            {
                status: tabKey,
                ...(searchQuery ? { search: searchQuery } : {}),
                ...(currentSort !== 'newest' ? { sort: currentSort } : {}),
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    }

    function handleSearchSubmit(e?: React.FormEvent) {
        if (e) {
            e.preventDefault();
        }

        router.get(
            '/admin/comments',
            {
                status,
                ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
                ...(currentSort !== 'newest' ? { sort: currentSort } : {}),
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    }

    function handleSortChange(newSort: string) {
        setCurrentSort(newSort);
        router.get(
            '/admin/comments',
            {
                status,
                ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
                sort: newSort,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    }

    function handleSelectComment(comment: Entry) {
        setSelectedCommentId(comment.id);
        setDecisionReason('');
        setFeedback(null);

        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setMobileDrawerOpen(true);
        }
    }

    async function executeDecision(
        action: string,
        suppliedReason = decisionReason,
    ) {
        if (!selectedComment) {
            return;
        }

        const reason = suppliedReason.trim();

        if (!reason) {
            setFeedback({
                type: 'error',
                text: 'Silakan isi alasan keputusan terlebih dahulu.',
            });

            return;
        }

        setBusy(true);
        setFeedback(null);

        try {
            await engagementPost(
                `/admin/comments/${selectedComment.id}/decision`,
                {
                    action,
                    reason,
                },
            );
            setFeedback({
                type: 'success',
                text: 'Keputusan berhasil disimpan dan status komentar diperbarui.',
            });
            setDecisionReason('');
            setConfirmAction(null);
            router.reload({
                only: ['comments', 'counts', 'analytics'],
            });
        } catch (error) {
            setFeedback({
                type: 'error',
                text:
                    (error as Error).message ||
                    'Terjadi kesalahan saat memproses keputusan.',
            });
        } finally {
            setBusy(false);
        }
    }

    function triggerDecision(action: string) {
        if (!selectedComment) {
            return;
        }

        const defaultReasons: Record<string, string> = {
            approve:
                decisionReason.trim() ||
                'Komentar aman dan sesuai panduan komunitas.',
            reject:
                decisionReason.trim() ||
                'Komentar melanggar pedoman komunitas.',
            remove: decisionReason.trim() || 'Komentar dihapus oleh moderator.',
            restore:
                decisionReason.trim() ||
                'Komentar dipulihkan setelah peninjauan ulang.',
            dismiss_reports:
                decisionReason.trim() ||
                'Laporan pengguna telah ditinjau dan ditutup.',
        };

        const reason = defaultReasons[action];
        setDecisionReason(reason);

        if (action === 'reject' || action === 'remove') {
            setConfirmAction({
                action,
                title:
                    action === 'reject'
                        ? 'Tolak dan Sembunyikan Komentar?'
                        : 'Hapus Komentar yang Diterbitkan?',
                description:
                    action === 'reject'
                        ? 'Komentar ini akan ditolak dan tidak akan ditampilkan kepada publik.'
                        : 'Komentar ini akan dihapus dari artikel berita publik.',
            });
        } else {
            executeDecision(action, reason);
        }
    }

    const quickReasons = [
        'Sesuai panduan komunitas',
        'Mengandung kata kasar / pelecehan',
        'Spam atau tautan promosi',
        'Informasi palsu / hoaks',
        'Laporan telah diselesaikan',
    ];

    function renderStatusBadge(comment: Entry) {
        if (comment.reports && comment.reports.length > 0) {
            const unresolved = comment.reports.find((r) => !r.resolved_at);
            const reason = unresolved
                ? unresolved.reason
                : comment.reports[0].reason;

            return (
                <Badge
                    variant="outline"
                    className="border-rose-200 bg-rose-50 font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                >
                    {reason || 'Dilaporkan'}
                </Badge>
            );
        }

        if (comment.ai_flagged) {
            const activeCats = Object.entries(comment.categories ?? {})
                .filter(([, v]) => v)
                .map(([k]) => k);
            const label =
                activeCats.length > 0
                    ? moderationLabel(activeCats[0])
                    : 'Ditandai AI';

            return (
                <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 font-medium text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                >
                    {label}
                </Badge>
            );
        }

        if (comment.status === 'published') {
            return (
                <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                    Disetujui
                </Badge>
            );
        }

        if (comment.status === 'rejected') {
            return (
                <Badge
                    variant="outline"
                    className="border-red-200 bg-red-50 font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                    Ditolak
                </Badge>
            );
        }

        if (comment.status === 'removed') {
            return (
                <Badge
                    variant="outline"
                    className="border-neutral-200 bg-neutral-100 font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300"
                >
                    Dihapus
                </Badge>
            );
        }

        return (
            <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            >
                Menunggu Peninjauan
            </Badge>
        );
    }

    const renderDetailsContent = (comment: Entry) => {
        const authorName =
            comment.guest_name ??
            (comment.user?.name || `Pengguna #${comment.user_id || 'Anonim'}`);
        const authorHandle = comment.guest_name
            ? 'Tamu'
            : comment.user?.name
              ? `@${comment.user.name.toLowerCase().replace(/\s+/g, '')}`
              : `@pengguna${comment.user_id}`;

        const unresolvedReports = comment.reports.filter((r) => !r.resolved_at);

        return (
            <div className="space-y-5">
                {/* Related News Card */}
                <Card className="gap-0 border-border/70 bg-muted/30 p-3.5 shadow-none">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted text-muted-foreground">
                                {comment.news?.image ? (
                                    <img
                                        src={comment.news.image}
                                        alt={
                                            comment.news.title ||
                                            'Gambar berita'
                                        }
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    <Newspaper className="size-6 text-muted-foreground/60" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="truncate text-sm font-semibold text-foreground">
                                    {comment.news?.title ||
                                        `Berita #${comment.news_id}`}
                                </h4>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {formatDate(comment.news?.created_at)} •
                                    Diterbitkan oleh admin
                                </p>
                            </div>
                        </div>
                        <a
                            href={`/news/${comment.news_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                            Lihat Berita
                            <ExternalLink className="size-3" />
                        </a>
                    </div>
                </Card>

                {/* Comment Information */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Avatar className="size-9 border border-border/70">
                                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                    {getInitials(authorName)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-foreground">
                                        {authorName}
                                    </span>
                                    {comment.guest_name && (
                                        <Badge
                                            variant="outline"
                                            className="px-1.5 py-0 text-[10px] font-normal"
                                        >
                                            Tamu
                                        </Badge>
                                    )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {authorHandle}
                                </span>
                            </div>
                        </div>
                        {renderStatusBadge(comment)}
                    </div>

                    <Card className="gap-0 border-border/70 bg-muted/40 p-3.5 shadow-none">
                        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                            {comment.content}
                        </p>
                    </Card>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Diajukan pada:</span>
                        <span>{formatDate(comment.created_at)}</span>
                    </div>
                </div>

                {/* Moderation Source Information */}
                {/* 1. User Reports */}
                {comment.reports.length > 0 && (
                    <Card className="gap-3 border-rose-200 bg-rose-50/40 p-4 shadow-none dark:border-rose-950/60 dark:bg-rose-950/20">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold text-rose-800 dark:text-rose-300">
                                <Flag className="size-3.5" />
                                <span>
                                    Laporan Pengguna ({comment.reports.length})
                                </span>
                            </div>
                            {unresolvedReports.length > 0 ? (
                                <Badge
                                    variant="destructive"
                                    className="py-0 text-[10px]"
                                >
                                    {unresolvedReports.length} Belum selesai
                                </Badge>
                            ) : (
                                <Badge
                                    variant="outline"
                                    className="py-0 text-[10px] text-emerald-700 dark:text-emerald-300"
                                >
                                    Selesai
                                </Badge>
                            )}
                        </div>

                        {comment.reports.map((report) => (
                            <div
                                key={report.id}
                                className="space-y-2 rounded-lg border border-rose-200/70 bg-background/90 p-3 text-xs dark:border-rose-900/40"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="size-6">
                                            <AvatarFallback className="bg-rose-100 text-[10px] font-semibold text-rose-800">
                                                {getInitials(
                                                    report.reporter_name ||
                                                        `Pengguna #${report.user_id}`,
                                                )}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-foreground">
                                            {report.reporter_name ||
                                                `Pengguna #${report.user_id}`}
                                        </span>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className="border-rose-300 bg-rose-100/50 text-[10px] font-medium text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                                    >
                                        {report.reason}
                                    </Badge>
                                </div>
                                <p className="text-muted-foreground italic">
                                    &ldquo;{report.reason}&rdquo;
                                </p>
                                <div className="text-[11px] text-muted-foreground">
                                    Dilaporkan: {formatDate(report.created_at)}{' '}
                                    {report.resolved_at &&
                                        `• Selesai: ${formatDate(report.resolved_at)}`}
                                </div>
                            </div>
                        ))}
                    </Card>
                )}

                {/* 2. AI Moderation */}
                {(comment.ai_flagged || comment.reason) && (
                    <Card className="gap-2.5 border-indigo-200 bg-indigo-50/40 p-4 shadow-none dark:border-indigo-950/60 dark:bg-indigo-950/20">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                                <ShieldAlert className="size-3.5" />
                                <span>Hasil Moderasi AI</span>
                            </div>
                            <Badge
                                variant={
                                    comment.ai_flagged
                                        ? 'destructive'
                                        : 'default'
                                }
                                className="py-0 text-[10px]"
                            >
                                {comment.ai_flagged
                                    ? 'Ditandai AI'
                                    : 'Aturan diperiksa'}
                            </Badge>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {Object.entries(comment.categories ?? {})
                                .filter(([, flagged]) => flagged)
                                .map(([cat]) => (
                                    <Badge
                                        key={cat}
                                        variant="outline"
                                        className="border-amber-300 bg-amber-50 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                    >
                                        AI: {moderationLabel(cat)}
                                    </Badge>
                                ))}
                            {Object.values(comment.categories ?? {}).every(
                                (v) => !v,
                            ) && (
                                <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                >
                                    Penanda:{' '}
                                    {comment.reason
                                        ? moderationLabel(comment.reason)
                                        : 'Pemeriksaan pedoman umum'}
                                </Badge>
                            )}
                        </div>

                        <p className="text-xs leading-normal text-muted-foreground">
                            {comment.reason === 'promotional_link'
                                ? 'Ditandai otomatis karena terdeteksi tautan promosi/iklan.'
                                : comment.reason ===
                                    'openai_service_unavailable'
                                  ? 'Ditahan sementara karena layanan moderasi AI sedang tidak tersedia.'
                                  : comment.reason
                                    ? `Alasan sistem: ${moderationLabel(comment.reason)}`
                                    : 'Ditandai oleh model moderasi otomatis untuk peninjauan admin.'}
                        </p>
                        <p className="text-[11px] text-muted-foreground/80 italic">
                            *Skor dan kategori AI disajikan sebagai indikator
                            penilaian model, bukan vonis mutlak.
                        </p>
                    </Card>
                )}

                {/* 3. Peninjauan Manual */}
                {!comment.ai_flagged && !comment.reports.length && (
                    <Card className="gap-0 border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground shadow-none">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <Shield className="size-3.5 text-primary" />
                            <span>Peninjauan Manual</span>
                        </div>
                        <p className="mt-1">
                            {comment.guest_name
                                ? 'Komentar tamu baru dalam antrean moderasi standar.'
                                : 'Komentar terdaftar yang memerlukan verifikasi moderator.'}
                        </p>
                    </Card>
                )}

                {/* Moderation History */}
                {comment.history.length > 0 && (
                    <div className="space-y-2 pt-2">
                        <Separator />
                        <h5 className="pt-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                            Riwayat Keputusan Moderasi ({comment.history.length}
                            )
                        </h5>
                        <div className="space-y-2">
                            {comment.history.map((event) => (
                                <Card
                                    key={event.id}
                                    className="gap-1 border-border/60 bg-muted/20 p-2.5 text-xs shadow-none"
                                >
                                    <div className="flex items-center justify-between font-medium">
                                        <span className="text-foreground">
                                            {moderationLabel(
                                                event.from_status ||
                                                    'submitted',
                                            )}{' '}
                                            →{' '}
                                            <span className="font-semibold text-primary">
                                                {moderationLabel(
                                                    event.to_status,
                                                )}
                                            </span>
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {formatDate(event.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-muted-foreground">
                                        {event.reason}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground/75">
                                        Oleh:{' '}
                                        {event.moderator_name
                                            ? `${event.moderator_name} (ID: ${event.moderator_id})`
                                            : event.moderator_id
                                              ? `Moderator #${event.moderator_id}`
                                              : 'Sistem Otomatis'}
                                    </p>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Feedback Alert */}
                {feedback && (
                    <Alert
                        variant={
                            feedback.type === 'error'
                                ? 'destructive'
                                : 'default'
                        }
                        className="text-xs"
                    >
                        {feedback.type === 'error' ? (
                            <AlertCircle className="size-4" />
                        ) : (
                            <Check className="size-4 text-emerald-600" />
                        )}
                        <AlertTitle className="text-xs font-semibold">
                            {feedback.type === 'error'
                                ? 'Perhatian'
                                : 'Berhasil'}
                        </AlertTitle>
                        <AlertDescription className="text-xs">
                            {feedback.text}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Admin Actions Area */}
                <div className="space-y-3 pt-2">
                    <Separator />
                    <div className="space-y-2 pt-2">
                        <Label
                            htmlFor={`decision-reason-${comment.id}`}
                            className="text-xs font-semibold"
                        >
                            Alasan Keputusan Moderasi{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id={`decision-reason-${comment.id}`}
                            placeholder="Tulis alasan keputusan atau pilih rekomendasi di bawah..."
                            value={decisionReason}
                            maxLength={500}
                            onChange={(e) => setDecisionReason(e.target.value)}
                            className="min-h-24 text-xs"
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {quickReasons.map((qr) => (
                                <Button
                                    key={qr}
                                    type="button"
                                    variant="outline"
                                    size="xs"
                                    onClick={() => setDecisionReason(qr)}
                                    className="h-6 rounded-full text-[11px] font-normal"
                                >
                                    {qr}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Action buttons based on status */}
                    <div className="pt-2">
                        {comment.status === 'pending_review' && (
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => triggerDecision('reject')}
                                    className="flex h-auto flex-col items-center justify-center border-rose-300 px-3 py-2.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/60 dark:hover:bg-rose-950/30"
                                >
                                    <div className="flex items-center gap-1.5 text-sm font-bold">
                                        <Trash2 className="size-4" />
                                        <span>Tolak Komentar</span>
                                    </div>
                                    <span className="text-[11px] font-normal text-rose-500">
                                        Sembunyikan komentar ini
                                    </span>
                                </Button>

                                <Button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => triggerDecision('approve')}
                                    className="flex h-auto flex-col items-center justify-center bg-blue-600 px-3 py-2.5 text-white shadow-sm hover:bg-blue-700"
                                >
                                    <div className="flex items-center gap-1.5 text-sm font-bold">
                                        <CheckCircle2 className="size-4" />
                                        <span>Setujui Komentar</span>
                                    </div>
                                    <span className="text-[11px] font-normal text-blue-100">
                                        Terbitkan komentar ini
                                    </span>
                                </Button>
                            </div>
                        )}

                        {comment.status === 'published' && (
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={busy}
                                onClick={() => triggerDecision('remove')}
                                className="w-full gap-2 py-5 text-sm font-semibold"
                            >
                                <Trash2 className="size-4" />
                                Hapus Komentar dari Berita
                            </Button>
                        )}

                        {comment.status === 'removed' && (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => triggerDecision('restore')}
                                className="w-full gap-2 py-5 text-sm font-semibold"
                            >
                                <RefreshCw className="size-4" />
                                Terbitkan Kembali Komentar
                            </Button>
                        )}

                        {comment.status === 'rejected' && (
                            <Card className="gap-0 border-border/70 bg-muted/30 p-3 text-center text-xs text-muted-foreground shadow-none">
                                Komentar ini telah ditolak. Keputusan diarsipkan
                                dalam riwayat.
                            </Card>
                        )}

                        {unresolvedReports.length > 0 &&
                            comment.status !== 'rejected' && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() =>
                                        triggerDecision('dismiss_reports')
                                    }
                                    className="mt-2 w-full gap-2 text-xs"
                                >
                                    <Check className="size-3.5" />
                                    Tutup Semua Laporan Pengguna
                                </Button>
                            )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Moderasi Komentar" />

            <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
                {/* 1. Page Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                            Moderasi Komentar
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Tinjau komentar yang dilaporkan dan ditandai AI
                            untuk menjaga diskusi komunitas tetap aman.
                        </p>
                    </div>

                    {/* Search & Sort Controls */}
                    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                        <form
                            onSubmit={handleSearchSubmit}
                            className="relative min-w-[260px] sm:min-w-[300px]"
                        >
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                aria-label="Cari komentar"
                                placeholder="Cari kata kunci, judul berita, atau pengguna..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-10 bg-card pr-8 pl-9 text-xs"
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label="Hapus pencarian"
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        router.get(
                                            '/admin/comments',
                                            {
                                                status,
                                                ...(currentSort !== 'newest'
                                                    ? { sort: currentSort }
                                                    : {}),
                                            },
                                            { preserveState: true },
                                        );
                                    }}
                                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-3.5" />
                                </Button>
                            )}
                        </form>

                        {/* Sort Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-10 gap-2 text-xs font-medium"
                                >
                                    <ArrowUpDown className="size-3.5 text-muted-foreground" />
                                    <span>
                                        {currentSort === 'oldest'
                                            ? 'Terlama dahulu'
                                            : 'Terbaru dahulu'}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                    onClick={() => handleSortChange('newest')}
                                    className="text-xs"
                                >
                                    Terbaru dahulu
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleSortChange('oldest')}
                                    className="text-xs"
                                >
                                    Terlama dahulu
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* 2. Filter Tabs */}
                <Tabs
                    value={status}
                    onValueChange={handleTabClick}
                    activationMode="manual"
                    className="gap-6"
                >
                    <div className="overflow-x-auto pb-1">
                        <TabsList aria-label="Status komentar">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;

                                return (
                                    <TabsTrigger key={tab.key} value={tab.key}>
                                        {Icon && <Icon className="size-4" />}
                                        {tab.label}
                                        <Badge variant="secondary">
                                            {tab.count}
                                        </Badge>
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>
                    </div>
                    <TabsContent value={status}>
                        {/* 3. Main Two-Column Layout */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                            {/* Left Column: Comment Listing (~60-65%) */}
                            <div className="space-y-3 lg:col-span-7 xl:col-span-7">
                                {comments.data.length === 0 ? (
                                    <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
                                        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                            <MessageSquare className="size-6" />
                                        </div>
                                        <CardTitle className="mt-4 text-base">
                                            Tidak ada komentar ditemukan
                                        </CardTitle>
                                        <CardDescription className="mt-1 max-w-sm text-xs">
                                            {searchQuery
                                                ? `Tidak ada komentar yang cocok dengan pencarian "${searchQuery}". Coba ubah kata kunci.`
                                                : status === 'pending_review'
                                                  ? 'Semua komentar telah ditinjau. Tidak ada komentar yang menunggu peninjauan saat ini.'
                                                  : status === 'reported'
                                                    ? 'Tidak ada laporan komentar yang belum terselesaikan.'
                                                    : 'Belum ada komentar dalam kategori ini.'}
                                        </CardDescription>
                                        {searchQuery && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSearchQuery('');
                                                    router.get(
                                                        '/admin/comments',
                                                        { status },
                                                        { preserveState: true },
                                                    );
                                                }}
                                                className="mt-4 text-xs"
                                            >
                                                Hapus Filter Pencarian
                                            </Button>
                                        )}
                                    </Card>
                                ) : (
                                    <div className="space-y-2.5">
                                        {comments.data.map((comment) => {
                                            const isSelected =
                                                selectedCommentId ===
                                                comment.id;
                                            const authorName =
                                                comment.guest_name ??
                                                (comment.user?.name ||
                                                    `Pengguna #${comment.user_id || 'Anonim'}`);
                                            const authorHandle =
                                                comment.guest_name
                                                    ? 'Tamu'
                                                    : comment.user?.name
                                                      ? `@${comment.user.name.toLowerCase().replace(/\s+/g, '')}`
                                                      : `@pengguna${comment.user_id}`;

                                            return (
                                                <Card
                                                    key={comment.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() =>
                                                        handleSelectComment(
                                                            comment,
                                                        )
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (
                                                            e.key === 'Enter' ||
                                                            e.key === ' '
                                                        ) {
                                                            e.preventDefault();
                                                            handleSelectComment(
                                                                comment,
                                                            );
                                                        }
                                                    }}
                                                    className={`cursor-pointer gap-0 p-3 shadow-none transition-all duration-150 sm:p-4 ${
                                                        isSelected
                                                            ? 'border-l-4 border-blue-400 border-l-blue-600 bg-blue-50/70 shadow-xs dark:border-blue-800 dark:bg-blue-950/25'
                                                            : 'border-border/70 bg-card hover:border-border hover:bg-muted/40'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        {/* Left: Thumbnail & Main Comment Info */}
                                                        <div className="flex min-w-0 flex-1 items-start gap-3">
                                                            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-muted text-muted-foreground sm:size-16">
                                                                {comment.news
                                                                    ?.image ? (
                                                                    <img
                                                                        src={
                                                                            comment
                                                                                .news
                                                                                .image
                                                                        }
                                                                        alt={
                                                                            comment
                                                                                .news
                                                                                .title ||
                                                                            'Gambar berita'
                                                                        }
                                                                        className="size-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <Newspaper className="size-6 text-muted-foreground/60" />
                                                                )}
                                                            </div>

                                                            <div className="min-w-0 flex-1 space-y-1">
                                                                <h3 className="truncate text-xs font-semibold text-foreground sm:text-sm">
                                                                    {comment
                                                                        .news
                                                                        ?.title ||
                                                                        `Berita #${comment.news_id}`}
                                                                </h3>
                                                                <div className="flex items-start gap-1.5 text-muted-foreground">
                                                                    <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/80" />
                                                                    <p className="line-clamp-2 text-xs leading-snug break-words text-foreground/85">
                                                                        {
                                                                            comment.content
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: Author info, Tag, Date, Chevron */}
                                                        <div className="flex shrink-0 items-center gap-3">
                                                            <div className="hidden items-center gap-2 text-right sm:flex">
                                                                <Avatar className="size-8 border border-border/60">
                                                                    <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                                                                        {getInitials(
                                                                            authorName,
                                                                        )}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="text-left">
                                                                    <div className="line-clamp-1 text-xs font-semibold text-foreground">
                                                                        {
                                                                            authorName
                                                                        }
                                                                    </div>
                                                                    <div className="text-[11px] text-muted-foreground">
                                                                        {
                                                                            authorHandle
                                                                        }
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col items-end gap-1">
                                                                {renderStatusBadge(
                                                                    comment,
                                                                )}
                                                                <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                                                                    {formatDate(
                                                                        comment.created_at,
                                                                    )}
                                                                </span>
                                                            </div>

                                                            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                                                        </div>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Pagination */}
                                <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
                                    <div>
                                        {comments.total ? (
                                            <span>
                                                Total {comments.total} komentar
                                                {comments.current_page
                                                    ? ` • Halaman ${comments.current_page} dari ${comments.last_page}`
                                                    : ''}
                                            </span>
                                        ) : (
                                            <span>
                                                {comments.data.length} komentar
                                                dimuat
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {comments.prev_page_url ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                asChild
                                                className="h-8 text-xs"
                                            >
                                                <Link
                                                    href={
                                                        comments.prev_page_url
                                                    }
                                                    preserveState
                                                    preserveScroll
                                                >
                                                    <ChevronLeft className="mr-1 size-3.5" />
                                                    Sebelumnya
                                                </Link>
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled
                                                className="h-8 text-xs opacity-50"
                                            >
                                                <ChevronLeft className="mr-1 size-3.5" />
                                                Sebelumnya
                                            </Button>
                                        )}

                                        {comments.next_page_url ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                asChild
                                                className="h-8 text-xs"
                                            >
                                                <Link
                                                    href={
                                                        comments.next_page_url
                                                    }
                                                    preserveState
                                                    preserveScroll
                                                >
                                                    Berikutnya
                                                    <ChevronRight className="ml-1 size-3.5" />
                                                </Link>
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled
                                                className="h-8 text-xs opacity-50"
                                            >
                                                Berikutnya
                                                <ChevronRight className="ml-1 size-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Selected Detail Komentar (~35-40%) - Desktop View */}
                            <div className="hidden lg:col-span-5 lg:block xl:col-span-5">
                                <Card className="sticky top-6 gap-0 border-border/80 p-5 shadow-xs">
                                    <CardHeader className="mb-4 flex flex-row items-center justify-between border-b border-border/70 p-0 pb-3">
                                        <CardTitle className="text-base font-bold">
                                            Detail Komentar
                                        </CardTitle>
                                        {selectedComment && (
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                onClick={() =>
                                                    setSelectedCommentId(null)
                                                }
                                                title="Batalkan pilihan komentar"
                                            >
                                                <X className="size-4" />
                                            </Button>
                                        )}
                                    </CardHeader>

                                    <CardContent className="p-0">
                                        {selectedComment ? (
                                            renderDetailsContent(
                                                selectedComment,
                                            )
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                                                    <UserIcon className="size-6 text-muted-foreground/60" />
                                                </div>
                                                <h4 className="mt-3 text-sm font-semibold text-foreground">
                                                    Tidak ada komentar dipilih
                                                </h4>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Pilih salah satu komentar
                                                    dari daftar di sebelah kiri
                                                    untuk melihat rincian dan
                                                    melakukan moderasi.
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Mobile Slide-over Drawer for Detail Komentar */}
                <Sheet
                    open={mobileDrawerOpen}
                    onOpenChange={setMobileDrawerOpen}
                >
                    <SheetContent
                        side="right"
                        className="w-full overflow-y-auto p-5 sm:max-w-md"
                    >
                        <SheetHeader className="border-b border-border/70 pb-3">
                            <SheetTitle className="text-base font-bold text-foreground">
                                Detail Komentar
                            </SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">
                            {selectedComment &&
                                renderDetailsContent(selectedComment)}
                        </div>
                    </SheetContent>
                </Sheet>

                {/* Confirmation Dialog for Destructive Decisions */}
                <AlertDialog
                    open={confirmAction !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setConfirmAction(null);
                        }
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-base font-bold">
                                {confirmAction?.title}
                            </AlertDialogTitle>
                            <AlertDialogDescription
                                asChild
                                className="text-xs text-muted-foreground"
                            >
                                <div>
                                    {confirmAction?.description}
                                    <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-xs text-foreground">
                                        <span className="font-semibold">
                                            Alasan keputusan:
                                        </span>{' '}
                                        {decisionReason || '—'}
                                    </div>
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="text-xs">
                                Batal
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    if (confirmAction) {
                                        executeDecision(confirmAction.action);
                                    }
                                }}
                                className="bg-destructive text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                            >
                                Ya, Lanjutkan Keputusan
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </main>
        </AppLayout>
    );
}
