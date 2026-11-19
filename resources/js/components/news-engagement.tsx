import { Link, router } from '@inertiajs/react';
import { Eye, Flag, Heart, Info, Share2, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AdminCommentFlag from '@/components/admin-comment-flag';
import { FeedbackToast } from '@/components/feedback-toast';
import type { Feedback } from '@/components/feedback-toast';
import { GuestCommentLimitDialog } from '@/components/guest-comment-limit-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { reportCategories } from '@/lib/comment-moderation-options';
import { csrfPost } from '@/lib/csrf-request';
import {
    commentThreads,
    copyArticleLink,
    visibleReadingClock,
} from '@/lib/news-engagement';

export interface PublicComment {
    id: string;
    author: string;
    avatar?: string | null;
    parent_id?: string | null;
    content: string;
    date: string;
    likes_count: number;
    liked_by_user: boolean;
    reported_by_user: boolean;
}
interface Props {
    news: {
        id: number;
        views: number;
        liked_by_user: boolean;
        likes_count: number;
    };
    comments: PublicComment[];
    authenticated: boolean;
    canCorrectModeration?: boolean;
}
export async function engagementPost(url: string, data: unknown) {
    const response = await csrfPost(url, data);
    const body = await response.json();

    if (!response.ok) {
        const error = new Error(
            Object.values(body.errors ?? {})
                .flat()
                .join(' ') ||
                body.message ||
                'Permintaan gagal. Silakan coba lagi.',
        );

        if (body.errors?.quota) {
            Object.assign(error, { quotaReached: true });
        }

        throw error;
    }

    return body;
}

export default function NewsEngagement({
    news,
    comments,
    authenticated,
    canCorrectModeration = false,
}: Props) {
    const [moderationCommentId, setModerationCommentId] = useState<
        string | null
    >(null);
    const [prompt, setPrompt] = useState(false);
    const [quotaOpen, setQuotaOpen] = useState(false);
    const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
    const [liked, setLiked] = useState(news.liked_by_user);
    const [likes, setLikes] = useState(news.likes_count);
    const [views, setViews] = useState(news.views);
    const [busy, setBusy] = useState(false);
    const [liking, setLiking] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [message, setMessage] = useState('');
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [content, setContent] = useState('');
    const [website, setWebsite] = useState('');
    const [challenge, setChallenge] = useState('');
    const [reportId, setReportId] = useState<string | null>(null);
    const [reportCategory, setReportCategory] = useState('');
    const [reportError, setReportError] = useState('');
    const [reported, setReported] = useState<string[]>([]);
    const [expanded, setExpanded] = useState<Record<string, number>>({});
    const [commentLikes, setCommentLikes] = useState<
        Record<string, { liked: boolean; likes_count: number }>
    >({});
    const [pendingLikes, setPendingLikes] = useState<string[]>([]);
    const commentLikeRequests = useRef(new Set<string>());
    const replyComposer = useRef<HTMLTextAreaElement>(null);
    const [replyContent, setReplyContent] = useState('');
    const [replyBusy, setReplyBusy] = useState(false);
    const replySubmission = useRef(false);
    const [replyNotice, setReplyNotice] = useState<{
        parentId: string;
        text: string;
        error: boolean;
    } | null>(null);
    const [reportReason, setReportReason] = useState('');
    const [replyId, setReplyId] = useState<string | null>(null);
    const submission = useRef(false);
    const likeSubmission = useRef(false);
    const canonical = `/news/${news.id}`;

    useEffect(() => {
        let stopped = false;
        let token = '';
        const clock = visibleReadingClock(performance.now());
        let timer: ReturnType<typeof setInterval> | undefined;
        fetch(`${canonical}/engagement`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error();
                }

                return response.json();
            })
            .then((data) => {
                if (stopped) {
                    return;
                }

                token = data.token;
                setChallenge(token);
                clock.reset(performance.now());
                timer = setInterval(() => {
                    if (
                        !clock.tick(
                            performance.now(),
                            document.visibilityState === 'visible',
                        )
                    ) {
                        return;
                    }

                    void engagementPost(`${canonical}/view`, { token })
                        .then((data) => {
                            if (!stopped) {
                                setViews(data.unique_views);
                            }
                        })
                        .catch(() => {
                            /* Analytics must not interrupt reading. */
                        });
                }, 250);
            })
            .catch(() => {
                if (!stopped) {
                    setMessage(
                        'Tidak dapat menyiapkan komentar tamu. Muat ulang halaman untuk mencoba lagi.',
                    );
                }
            });
        const visibility = () => {
            clock.reset(performance.now());
        };
        document.addEventListener('visibilitychange', visibility);

        return () => {
            stopped = true;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [canonical]);

    useEffect(() => {
        if (replyId) {
            replyComposer.current?.focus();
        }
    }, [replyId]);

    async function like() {
        if (!authenticated) {
            setPrompt(true);

            return;
        }

        if (likeSubmission.current) {
            return;
        }

        likeSubmission.current = true;
        setLiking(true);
        setLiked(!liked);
        setLikes(likes + (liked ? -1 : 1));

        try {
            const data = await engagementPost(`${canonical}/like`, {});
            setLiked(data.liked);
            setLikes(data.likes_count);
        } catch (error) {
            setLiked(liked);
            setLikes(likes);
            setMessage((error as Error).message);
        } finally {
            likeSubmission.current = false;
            setLiking(false);
        }
    }
    async function share() {
        setSharing(true);
        setMessage(
            await copyArticleLink(
                news.id,
                window.location.origin,
                navigator.clipboard,
            ),
        );
        setSharing(false);
    }

    async function submit() {
        if (submission.current || !content.trim()) {
            return;
        }

        submission.current = true;
        setBusy(true);
        setMessage('');

        try {
            const data = await engagementPost(`${canonical}/comment`, {
                content,
                website,
                challenge,
            });
            setContent('');
            setRemainingQuota(data.remaining_quota ?? null);

            if (data.status === 'published') {
                setFeedback({
                    variant: 'success',
                    message: 'Komentar diterbitkan.',
                });
            } else {
                setFeedback(null);
                setMessage(
                    data.message ?? 'Komentar menunggu peninjauan moderator.',
                );
            }

            router.reload({ only: ['comments'] });
        } catch (error) {
            if ((error as Error & { quotaReached?: boolean }).quotaReached) {
                setQuotaOpen(true);
            } else {
                setMessage((error as Error).message);
            }
        } finally {
            submission.current = false;
            setBusy(false);
        }
    }
    async function submitReply(parentId: string) {
        if (replySubmission.current || !replyContent.trim()) {
            return;
        }

        replySubmission.current = true;
        setReplyBusy(true);
        setReplyNotice(null);

        try {
            const data = await engagementPost(`/comments/${parentId}/replies`, {
                content: replyContent,
                challenge,
            });
            setReplyContent('');
            setReplyId(null);
            setReplyNotice({
                parentId,
                error: false,
                text:
                    data.status === 'published'
                        ? 'Balasan diterbitkan.'
                        : 'Balasan menunggu peninjauan moderator.',
            });

            if (data.status === 'published') {
                await new Promise<void>((resolve) => {
                    router.reload({
                        only: ['comments'],
                        onSuccess: (page) => {
                            const updated = page.props
                                .comments as PublicComment[];
                            const threads = commentThreads(updated);
                            const rootId =
                                threads.rootIds.get(parentId) ?? parentId;
                            const count =
                                threads.replies.get(rootId)?.length ?? 0;
                            // Reveal the newly appended reply, including when older replies were collapsed.
                            setExpanded((values) => ({
                                ...values,
                                [rootId]: Math.max(3, count),
                            }));
                        },
                        onError: () =>
                            setReplyNotice({
                                parentId,
                                error: true,
                                text: 'Balasan tersimpan, tetapi daftar belum diperbarui. Muat ulang halaman untuk melihatnya.',
                            }),
                        onFinish: () => resolve(),
                    });
                });
            }

            setRemainingQuota(data.remaining_quota ?? null);
        } catch (error) {
            if ((error as Error & { quotaReached?: boolean }).quotaReached) {
                setQuotaOpen(true);

                return;
            }

            setReplyNotice({
                parentId,
                error: true,
                text: (error as Error).message,
            });
        } finally {
            replySubmission.current = false;
            setReplyBusy(false);
        }
    }

    async function report() {
        if (submission.current || !reportCategory) {
            return;
        }

        submission.current = true;
        setBusy(true);

        try {
            const data = await engagementPost(`/comments/${reportId}/report`, {
                category: reportCategory,
                details: reportReason.trim(),
            });
            setReported((ids) => [...ids, reportId!]);
            setReportId(null);
            setReportReason('');
            setMessage(data.message);
        } catch (error) {
            setReportError((error as Error).message);
        } finally {
            submission.current = false;
            setBusy(false);
        }
    }
    async function likeComment(comment: PublicComment) {
        if (!authenticated) {
            setPrompt(true);

            return;
        }

        if (commentLikeRequests.current.has(comment.id)) {
            return;
        }

        commentLikeRequests.current.add(comment.id);
        setPendingLikes((ids) => [...ids, comment.id]);

        try {
            const data = await engagementPost(
                `/comments/${comment.id}/like`,
                {},
            );
            setCommentLikes((values) => ({ ...values, [comment.id]: data }));
        } catch (error) {
            setMessage((error as Error).message);
        } finally {
            commentLikeRequests.current.delete(comment.id);
            setPendingLikes((ids) => ids.filter((id) => id !== comment.id));
        }
    }
    const primaryButton =
        'rounded-lg border border-green-600 bg-green-700 px-4 py-2 text-sm text-white enabled:hover:border-green-700 enabled:hover:bg-green-800 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:border-gray-700 dark:disabled:bg-gray-700 dark:disabled:text-gray-400';
    const action =
        'inline-flex items-center gap-1 rounded text-xs text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50';
    const threads = commentThreads(comments);

    function renderComment(comment: PublicComment, isReply = false) {
        const replies = isReply ? [] : (threads.replies.get(comment.id) ?? []);
        const recipient =
            isReply && comment.parent_id
                ? threads.byId.get(comment.parent_id)
                : undefined;
        const visible = expanded[comment.id] ?? 0;
        const reaction = commentLikes[comment.id] ?? {
            liked: comment.liked_by_user,
            likes_count: comment.likes_count,
        };
        const isReported =
            comment.reported_by_user || reported.includes(comment.id);

        return (
            <article
                key={comment.id}
                className="min-w-0 space-y-3 rounded-xl border border-border/50 bg-secondary p-4 sm:p-5"
            >
                <div className="group/comment space-y-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <Avatar className="size-8 shrink-0">
                            <AvatarImage
                                src={comment.avatar ?? undefined}
                                alt={comment.author}
                            />
                            <AvatarFallback>
                                {Array.from(
                                    comment.author.trim(),
                                )[0]?.toLocaleUpperCase('id') || 'T'}
                            </AvatarFallback>
                        </Avatar>
                        <strong className="min-w-0 flex-1 break-words">
                            {comment.author}
                        </strong>
                        <button
                            type="button"
                            disabled={!canCorrectModeration && isReported}
                            className={`${action} focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/comment:opacity-100 [@media(hover:hover)]:group-hover/comment:opacity-100`}
                            onClick={() => {
                                if (!authenticated) {
                                    setPrompt(true);

                                    return;
                                }

                                if (canCorrectModeration) {
                                    setModerationCommentId(comment.id);

                                    return;
                                }

                                setReportCategory('');
                                setReportReason('');
                                setReportError('');
                                setReportId(comment.id);
                            }}
                        >
                            <Flag size={13} aria-hidden="true" />
                            {canCorrectModeration
                                ? 'Tandai Admin'
                                : isReported
                                  ? 'Dilaporkan'
                                  : 'Laporkan'}
                        </button>
                    </div>
                    <p className="text-sm break-words whitespace-pre-wrap">
                        {recipient && (
                            <span className="font-medium">
                                @{recipient.author}:{' '}
                            </span>
                        )}
                        {comment.content}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{comment.date}</span>
                        <span aria-hidden="true">&middot;</span>
                        <button
                            type="button"
                            className={action}
                            aria-label={`${reaction.liked ? 'Batal menyukai' : 'Sukai'} komentar: ${reaction.likes_count} suka`}
                            aria-pressed={reaction.liked}
                            disabled={pendingLikes.includes(comment.id)}
                            onClick={() => void likeComment(comment)}
                        >
                            <Heart
                                size={13}
                                aria-hidden="true"
                                fill={reaction.liked ? 'currentColor' : 'none'}
                            />
                            {reaction.likes_count}
                        </button>
                        <span aria-hidden="true">&middot;</span>
                        <button
                            type="button"
                            className={action}
                            disabled={replyBusy}
                            aria-expanded={replyId === comment.id}
                            aria-controls={
                                replyId === comment.id
                                    ? `reply-form-${comment.id}`
                                    : undefined
                            }
                            onClick={() => {
                                if (replyId !== comment.id) {
                                    setReplyContent('');
                                    setReplyNotice(null);
                                    setReplyId(comment.id);
                                } else {
                                    replyComposer.current?.focus();
                                }
                            }}
                        >
                            Balas
                        </button>
                    </div>
                </div>
                {replyId === comment.id && (
                    <form
                        id={`reply-form-${comment.id}`}
                        className="space-y-2 border-l border-border pl-3"
                        aria-busy={replyBusy}
                        onSubmit={(event) => {
                            event.preventDefault();
                            void submitReply(comment.id);
                        }}
                    >
                        <label
                            htmlFor={`reply-content-${comment.id}`}
                            className="block text-xs font-medium break-words"
                        >
                            Membalas @{comment.author}
                        </label>
                        <Textarea
                            ref={replyComposer}
                            id={`reply-content-${comment.id}`}
                            required
                            maxLength={1000}
                            rows={2}
                            placeholder="Tulis balasan..."
                            value={replyContent}
                            disabled={replyBusy}
                            onChange={(event) =>
                                setReplyContent(event.target.value)
                            }
                            className="max-h-40 bg-background"
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={replyBusy}
                                onClick={() => {
                                    setReplyId(null);
                                    setReplyContent('');
                                    setReplyNotice(null);
                                }}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                className={primaryButton}
                                disabled={
                                    replyBusy ||
                                    !replyContent.trim() ||
                                    (!authenticated && !challenge)
                                }
                            >
                                {replyBusy ? 'Mengirim...' : 'Kirim Balasan'}
                            </Button>
                        </div>
                    </form>
                )}
                {replyNotice?.parentId === comment.id && (
                    <p
                        role={replyNotice.error ? 'alert' : 'status'}
                        className={`text-xs break-words ${replyNotice.error ? 'text-destructive' : 'text-muted-foreground'}`}
                    >
                        {replyNotice.text}
                    </p>
                )}
                {replies.length > 0 && (
                    <div className="space-y-3">
                        <button
                            type="button"
                            className={action}
                            aria-expanded={visible > 0}
                            aria-controls={`replies-${comment.id}`}
                            onClick={() =>
                                setExpanded((values) => ({
                                    ...values,
                                    [comment.id]: visible ? 0 : 3,
                                }))
                            }
                        >
                            {visible
                                ? 'Sembunyikan balasan'
                                : `Lihat ${replies.length} balasan`}
                        </button>
                        <div
                            id={`replies-${comment.id}`}
                            hidden={!visible}
                            className="space-y-3 border-l border-border pl-2 sm:pl-4"
                        >
                            {replies
                                .slice(0, visible)
                                .map((reply) => renderComment(reply, true))}
                            {visible > 0 && visible < replies.length && (
                                <button
                                    type="button"
                                    className={action}
                                    onClick={() =>
                                        setExpanded((values) => ({
                                            ...values,
                                            [comment.id]: visible + 3,
                                        }))
                                    }
                                >
                                    Lihat balasan lainnya
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </article>
        );
    }
    const button =
        'rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary disabled:opacity-50';

    return (
        <section aria-label="Interaksi berita" className="space-y-6">
            <FeedbackToast
                feedback={feedback}
                onDismiss={() => setFeedback(null)}
                duration={5000}
            />
            <div className="flex flex-wrap items-center gap-3 border-y border-border py-4">
                <span
                    className="flex items-center gap-2 text-sm"
                    title="Pengunjung unik; pengunjung tamu merupakan perkiraan"
                >
                    <Eye size={18} />
                    {views.toLocaleString()} pengunjung unik
                </span>
                <button
                    className={button}
                    aria-pressed={liked}
                    disabled={liking}
                    onClick={like}
                >
                    <Heart
                        className="mr-2 inline"
                        size={16}
                        fill={liked ? 'currentColor' : 'none'}
                    />
                    {liked ? 'Disukai' : 'Suka'} | {likes}
                </button>
                <button className={button} disabled={sharing} onClick={share}>
                    <Share2 className="mr-2 inline" size={16} />
                    Bagikan
                </button>
            </div>
            {message && (
                <p
                    role="status"
                    className="rounded-lg bg-secondary p-3 text-sm break-words"
                >
                    {message}
                </p>
            )}
            {canCorrectModeration && (
                <AdminCommentFlag
                    newsId={news.id}
                    selectedId={moderationCommentId}
                    onSelect={setModerationCommentId}
                />
            )}
            <h2 className="text-lg font-semibold">
                Komentar ({comments.length})
            </h2>
            <form
                className="space-y-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <div className="hidden" aria-hidden="true">
                    <label>
                        Situs web
                        <input
                            tabIndex={-1}
                            autoComplete="off"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                        />
                    </label>
                </div>
                <label htmlFor="news-comment" className="sr-only">
                    Komentar
                </label>
                <Textarea
                    id="news-comment"
                    required
                    maxLength={1000}
                    rows={4}
                    placeholder="Tulis komentar..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-28 w-full rounded-xl border-border bg-background p-4 text-sm"
                />
                <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/60 p-3 text-sm text-muted-foreground sm:p-4">
                    <ShieldCheck
                        className="mt-0.5 size-5 shrink-0"
                        aria-hidden="true"
                    />
                    <p>
                        Komentar diperiksa otomatis menggunakan OpenAI dan dapat
                        ditinjau moderator sebelum diterbitkan.
                    </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {!authenticated && remainingQuota !== null && (
                        <p
                            role="status"
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                            <Info
                                className="size-4 shrink-0"
                                aria-hidden="true"
                            />
                            <span>
                                Sisa kuota komentar hari ini:{' '}
                                <strong className="font-semibold text-primary">
                                    {remainingQuota}
                                </strong>
                            </span>
                        </p>
                    )}
                    <Button
                        type="submit"
                        className={`${primaryButton} min-h-11 w-full shrink-0 sm:ml-auto sm:w-auto`}
                        disabled={
                            busy ||
                            !content.trim() ||
                            (!authenticated && !challenge)
                        }
                    >
                        {busy ? 'Memproses...' : 'Kirim Komentar'}
                    </Button>
                </div>
            </form>
            {comments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    Belum ada komentar. Jadilah yang pertama!
                </p>
            )}
            {threads.roots.map((comment) => renderComment(comment))}
            <GuestCommentLimitDialog
                open={quotaOpen}
                onOpenChange={setQuotaOpen}
            />
            <Dialog open={prompt} onOpenChange={setPrompt}>
                <DialogContent>
                    <DialogTitle>Masuk diperlukan</DialogTitle>
                    <DialogDescription>
                        Silakan masuk atau buat akun untuk menggunakan fitur
                        ini.
                    </DialogDescription>
                    <div className="flex justify-end gap-3">
                        <Link
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            href="/login"
                        >
                            Masuk
                        </Link>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog
                open={reportId !== null}
                onOpenChange={(open) => {
                    if (!open && !busy) {
                        setReportId(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogTitle>Laporkan komentar</DialogTitle>
                    <DialogDescription>
                        Jelaskan mengapa komentar ini perlu ditinjau.
                    </DialogDescription>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void report();
                        }}
                    >
                        <label className="block space-y-1 text-sm">
                            <span>Kategori laporan (wajib)</span>
                            <select
                                required
                                value={reportCategory}
                                disabled={busy}
                                onChange={(event) =>
                                    setReportCategory(event.target.value)
                                }
                                className="block w-full rounded-md border border-border bg-background p-2"
                            >
                                <option value="">Pilih kategori</option>
                                {reportCategories.map((category) => (
                                    <option key={category} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block space-y-1 text-sm">
                            <span>Keterangan tambahan (opsional)</span>
                            <textarea
                                maxLength={450}
                                rows={3}
                                disabled={busy}
                                value={reportReason}
                                onChange={(event) =>
                                    setReportReason(event.target.value)
                                }
                                className="block w-full rounded-md border border-border bg-background p-3"
                            />
                        </label>
                        {reportError && (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {reportError}
                            </p>
                        )}
                        <div className="flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setReportId(null)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                className={primaryButton}
                                disabled={busy || !reportCategory}
                            >
                                {busy ? 'Mengirim...' : 'Kirim Laporan'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </section>
    );
}
