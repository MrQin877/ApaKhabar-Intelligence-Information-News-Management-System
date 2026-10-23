import { Flag, Heart, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { engagementPost } from '@/components/news-engagement';
import { GuestCommentLimitDialog } from '@/components/guest-comment-limit-dialog';
import type { PublicComment } from '@/components/news-engagement';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
    adminFlagReasons,
    reportCategories,
} from '@/lib/comment-moderation-options';
import { metaRequest } from '@/lib/meta-auth';

type Comment = PublicComment & {
    replies_count: number;
    recipient?: string | null;
};
type Page = { data: Comment[]; current_page: number; last_page: number };
type ReplyPage = Page & { open: boolean; loading: boolean };

const action =
    'inline-flex items-center gap-1 rounded text-xs text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 [@media(pointer:coarse)]:min-h-11';
const primary =
    'border border-green-600 bg-green-600 text-white enabled:hover:border-green-700 enabled:hover:bg-green-700 disabled:opacity-50';

export function ShortComments({
    shortId,
    authenticated,
    canFlag,
    count,
    onCountChange,
    onClose,
    onLogin,
    fullScreen = false,
}: {
    shortId: number;
    authenticated: boolean;
    canFlag: boolean;
    count: number;
    onCountChange: (count: number) => void;
    onClose: () => void;
    onLogin: () => void;
    fullScreen?: boolean;
}) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [page, setPage] = useState(0);
    const [lastPage, setLastPage] = useState(1);
    const [replies, setReplies] = useState<Record<string, ReplyPage>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [quotaOpen, setQuotaOpen] = useState(false);
    const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
    const [challenge, setChallenge] = useState('');
    const [content, setContent] = useState('');
    const [website, setWebsite] = useState('');
    const [busy, setBusy] = useState(false);
    const [replyTarget, setReplyTarget] = useState<{
        id: string;
        rootId: string;
        author: string;
    } | null>(null);
    const [replyText, setReplyText] = useState('');
    const [liked, setLiked] = useState<
        Record<string, { liked: boolean; likes_count: number }>
    >({});
    const [pendingLikes, setPendingLikes] = useState<string[]>([]);
    const [reportId, setReportId] = useState<string | null>(null);
    const [category, setCategory] = useState('');
    const [explanation, setExplanation] = useState('');
    const [reported, setReported] = useState<string[]>([]);
    const submission = useRef(false);
    const likeRequests = useRef(new Set<string>());
    const base = `/shorts/${shortId}`;

    useEffect(() => {
        let live = true;
        void Promise.all([
            metaRequest<{ comments: Page; count: number }>(
                `${base}/comments?page=1`,
            ),
            metaRequest<{ challenge: string }>(`${base}/engagement`),
        ])
            .then(([response, context]) => {
                if (!live) {
                    return;
                }

                setComments(response.comments.data);
                setPage(response.comments.current_page);
                setLastPage(response.comments.last_page);
                onCountChange(response.count);
                setChallenge(context.challenge);
                setError('');
            })
            .catch(() => {
                if (live) {
                    setError('Komentar belum dapat dimuat. Coba lagi.');
                }
            })
            .finally(() => {
                if (live) {
                    setLoading(false);
                }
            });

        return () => {
            live = false;
        };
    }, [base, onCountChange]);

    async function loadMore() {
        if (loading || page >= lastPage) {
            return;
        }

        setLoading(true);

        try {
            const response = await metaRequest<{
                comments: Page;
                count: number;
            }>(`${base}/comments?page=${page + 1}`);
            setComments((previous) => [
                ...previous,
                ...response.comments.data.filter(
                    (item) => !previous.some((old) => old.id === item.id),
                ),
            ]);
            setPage(response.comments.current_page);
            setLastPage(response.comments.last_page);
            onCountChange(response.count);
            setError('');
        } catch {
            setError('Komentar lainnya belum dapat dimuat.');
        } finally {
            setLoading(false);
        }
    }

    async function loadReplies(rootId: string, nextPage = 1) {
        setReplies((current) => ({
            ...current,
            [rootId]: {
                data: current[rootId]?.data ?? [],
                current_page: current[rootId]?.current_page ?? 0,
                last_page: current[rootId]?.last_page ?? 1,
                open: true,
                loading: true,
            },
        }));

        try {
            const response = await metaRequest<Page>(
                `${base}/comments/${rootId}/replies?page=${nextPage}`,
            );
            setReplies((current) => ({
                ...current,
                [rootId]: {
                    ...response,
                    data:
                        nextPage === 1
                            ? response.data
                            : [
                                  ...(current[rootId]?.data ?? []),
                                  ...response.data,
                              ],
                    open: true,
                    loading: false,
                },
            }));
        } catch {
            setReplies((current) => ({
                ...current,
                [rootId]: { ...current[rootId], loading: false },
            }));
            setError('Balasan belum dapat dimuat.');
        }
    }

    async function submit() {
        if (submission.current || !content.trim()) {
            return;
        }

        submission.current = true;
        setBusy(true);
        setError('');

        try {
            const result = await engagementPost(`${base}/comments`, {
                content,
                website,
                challenge,
            });
            setContent('');
            setRemainingQuota(result.remaining_quota ?? null);
            setNotice(result.message);

            if (result.comment) {
                setComments((previous) => [result.comment, ...previous]);
                onCountChange(count + 1);
            }
        } catch (caught) {
            if ((caught as Error & { quotaReached?: boolean }).quotaReached)
                setQuotaOpen(true);
            else setError((caught as Error).message);
        } finally {
            submission.current = false;
            setBusy(false);
        }
    }

    async function submitReply() {
        if (!replyTarget || submission.current || !replyText.trim()) {
            return;
        }

        submission.current = true;
        setBusy(true);
        setError('');

        try {
            const result = await engagementPost(
                `${base}/comments/${replyTarget.id}/replies`,
                { content: replyText, challenge },
            );

            if (result.comment) {
                const rootId = replyTarget.rootId;
                setReplies((current) => ({
                    ...current,
                    [rootId]: {
                        data: [
                            ...(current[rootId]?.data ?? []),
                            result.comment,
                        ],
                        current_page: current[rootId]?.current_page ?? 1,
                        last_page: current[rootId]?.last_page ?? 1,
                        open: true,
                        loading: false,
                    },
                }));
                setComments((previous) =>
                    previous.map((item) =>
                        item.id === rootId
                            ? { ...item, replies_count: item.replies_count + 1 }
                            : item,
                    ),
                );
                onCountChange(count + 1);
            }

            setNotice(result.message);
            setRemainingQuota(result.remaining_quota ?? null);
            setReplyText('');
            setReplyTarget(null);
        } catch (caught) {
            if ((caught as Error & { quotaReached?: boolean }).quotaReached)
                setQuotaOpen(true);
            else setError((caught as Error).message);
        } finally {
            submission.current = false;
            setBusy(false);
        }
    }

    async function likeComment(comment: Comment) {
        if (!authenticated) {
            onLogin();

            return;
        }

        if (likeRequests.current.has(comment.id)) {
            return;
        }

        likeRequests.current.add(comment.id);
        setPendingLikes((items) => [...items, comment.id]);

        try {
            const result = await engagementPost(
                `${base}/comments/${comment.id}/like`,
                {},
            );
            setLiked((current) => ({ ...current, [comment.id]: result }));
        } catch (caught) {
            setError((caught as Error).message);
        } finally {
            likeRequests.current.delete(comment.id);
            setPendingLikes((items) => items.filter((id) => id !== comment.id));
        }
    }

    async function submitReport() {
        if (!reportId || !category || submission.current) {
            return;
        }

        submission.current = true;
        setBusy(true);
        setError('');

        try {
            const result = await engagementPost(
                `${base}/comments/${reportId}/${canFlag ? 'flag' : 'report'}`,
                canFlag
                    ? { category, explanation }
                    : { category, details: explanation },
            );
            setReported((items) => [...items, reportId]);
            setReportId(null);
            setCategory('');
            setExplanation('');
            setNotice(result.message);
        } catch (caught) {
            setError((caught as Error).message);
        } finally {
            submission.current = false;
            setBusy(false);
        }
    }

    function renderComment(comment: Comment, rootId: string, isReply = false) {
        const reaction = liked[comment.id] ?? {
            liked: comment.liked_by_user,
            likes_count: comment.likes_count,
        };
        const thread = replies[rootId];
        const alreadyReported =
            comment.reported_by_user || reported.includes(comment.id);

        return (
            <article
                key={comment.id}
                className="min-w-0 space-y-3 rounded-xl bg-secondary p-4"
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
                        <strong className="min-w-0 break-words">
                            {comment.author}
                        </strong>
                        <button
                            type="button"
                            className={`${action} focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/comment:opacity-100 [@media(hover:hover)]:group-hover/comment:opacity-100`}
                            disabled={!canFlag && alreadyReported}
                            onClick={() => {
                                if (!authenticated) {
                                    onLogin();

                                    return;
                                }

                                setReportId(comment.id);
                                setCategory('');
                                setExplanation('');
                                setError('');
                            }}
                        >
                            <Flag size={13} aria-hidden="true" />
                            {canFlag
                                ? 'Tandai Admin'
                                : alreadyReported
                                  ? 'Dilaporkan'
                                  : 'Laporkan'}
                        </button>
                    </div>
                    <p className="text-sm break-words whitespace-pre-wrap">
                        {isReply && comment.recipient && (
                            <span className="font-medium">
                                @{comment.recipient}:{' '}
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
                            aria-expanded={replyTarget?.id === comment.id}
                            onClick={() => {
                                setReplyTarget({
                                    id: comment.id,
                                    rootId,
                                    author: comment.author,
                                });
                                setReplyText('');
                            }}
                        >
                            Balas
                        </button>
                    </div>
                </div>
                {replyTarget?.id === comment.id && (
                    <form
                        className="space-y-2 border-l border-border pl-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void submitReply();
                        }}
                    >
                        <label
                            htmlFor={`short-reply-${comment.id}`}
                            className="block text-xs font-medium"
                        >
                            Membalas @{comment.author}
                        </label>
                        <Textarea
                            id={`short-reply-${comment.id}`}
                            autoFocus
                            required
                            maxLength={1000}
                            rows={2}
                            value={replyText}
                            disabled={busy}
                            onChange={(event) =>
                                setReplyText(event.target.value)
                            }
                            placeholder="Tulis balasan..."
                            className="max-h-40 bg-background"
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                    setReplyTarget(null);
                                    setReplyText('');
                                }}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                className={primary}
                                disabled={busy || !replyText.trim() || (!authenticated && !challenge)}
                            >
                                {busy ? 'Mengirim...' : 'Kirim Balasan'}
                            </Button>
                        </div>
                    </form>
                )}
                {!isReply && comment.replies_count > 0 && (
                    <div className="space-y-3">
                        <button
                            type="button"
                            className={action}
                            aria-expanded={thread?.open ?? false}
                            onClick={() => {
                                if (thread?.open) {
                                    setReplies((current) => ({
                                        ...current,
                                        [rootId]: {
                                            ...current[rootId],
                                            open: false,
                                        },
                                    }));
                                } else if (thread?.data?.length) {
                                    setReplies((current) => ({
                                        ...current,
                                        [rootId]: {
                                            ...current[rootId],
                                            open: true,
                                        },
                                    }));
                                } else {
                                    void loadReplies(rootId);
                                }
                            }}
                        >
                            {thread?.open
                                ? 'Sembunyikan balasan'
                                : `Lihat balasan (${comment.replies_count})`}
                        </button>
                        {thread?.open && (
                            <div
                                className="space-y-3 border-l border-border pl-4"
                                aria-label={`Balasan ${comment.author}`}
                            >
                                {thread.data.map((reply) =>
                                    renderComment(reply, rootId, true),
                                )}
                                {thread.loading && (
                                    <p
                                        role="status"
                                        className="text-xs text-muted-foreground"
                                    >
                                        Memuat balasan...
                                    </p>
                                )}
                                {!thread.loading &&
                                    thread.current_page < thread.last_page && (
                                        <button
                                            type="button"
                                            className={action}
                                            onClick={() =>
                                                void loadReplies(
                                                    rootId,
                                                    thread.current_page + 1,
                                                )
                                            }
                                        >
                                            Lihat balasan lainnya
                                        </button>
                                    )}
                            </div>
                        )}
                    </div>
                )}
            </article>
        );
    }

    return (
        <section
            aria-label="Komentar video pendek"
            className={`flex h-full min-h-0 flex-col overflow-hidden bg-card ${fullScreen ? 'w-full' : 'rounded-xl border'}`}
        >
            <header
                className={`flex shrink-0 items-center justify-between border-b px-4 py-3 ${fullScreen ? 'pt-[calc(0.75rem+env(safe-area-inset-top))]' : ''}`}
            >
                <h2 className="text-sm font-semibold">Komentar ({count})</h2>
                <Button
                    className="size-11"
                    size="icon"
                    variant="ghost"
                    aria-label="Tutup komentar"
                    onClick={onClose}
                >
                    <X className="size-4" />
                </Button>
            </header>
            <div
                className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
                aria-busy={loading}
            >
                {loading && page === 0 && (
                    <p role="status" className="text-sm text-muted-foreground">
                        Memuat komentar...
                    </p>
                )}
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                {notice && (
                    <p role="status" className="text-sm text-primary">
                        {notice}
                    </p>
                )}
                {!loading && comments.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        Belum ada komentar. Jadilah yang pertama!
                    </p>
                )}
                {comments.map((comment) => renderComment(comment, comment.id))}
                {page < lastPage && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={loading}
                        onClick={() => void loadMore()}
                    >
                        Lihat komentar lainnya
                    </Button>
                )}
            </div>
            <form
                className={`shrink-0 space-y-2 border-t bg-card p-4 ${fullScreen ? 'pb-[calc(1rem+env(safe-area-inset-bottom))]' : ''}`}
                onSubmit={(event) => {
                    event.preventDefault();
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
                            onChange={(event) => setWebsite(event.target.value)}
                        />
                    </label>
                </div>
                <label
                    htmlFor="short-comment-content"
                    className="block text-xs font-medium"
                >
                    Komentar
                </label>
                <Textarea
                    id="short-comment-content"
                    required
                    maxLength={1000}
                    rows={2}
                    placeholder="Tulis komentar..."
                    value={content}
                    disabled={busy}
                    onChange={(event) => setContent(event.target.value)}
                    className="max-h-28 bg-background"
                />
                <div className="flex justify-end">
                    <Button
                        type="submit"
                        size="sm"
                        className={primary}
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
            {!authenticated && remainingQuota !== null && (
                <p role="status" className="px-4 text-xs text-muted-foreground">
                    Sisa kuota komentar hari ini: {remainingQuota}
                </p>
            )}
            <GuestCommentLimitDialog
                open={quotaOpen}
                onOpenChange={setQuotaOpen}
            />
            <Dialog
                open={reportId !== null}
                onOpenChange={(open) => {
                    if (!open && !busy) {
                        setReportId(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogTitle>
                        {canFlag ? 'Tandai komentar' : 'Laporkan komentar'}
                    </DialogTitle>
                    <DialogDescription>
                        Jelaskan mengapa komentar ini perlu ditinjau.
                    </DialogDescription>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void submitReport();
                        }}
                    >
                        <label className="block space-y-1 text-sm">
                            <span>
                                {canFlag
                                    ? 'Alasan moderasi (wajib)'
                                    : 'Kategori laporan (wajib)'}
                            </span>
                            <select
                                required
                                value={category}
                                disabled={busy}
                                onChange={(event) =>
                                    setCategory(event.target.value)
                                }
                                className="block w-full rounded-md border border-border bg-background p-2"
                            >
                                <option value="">Pilih kategori</option>
                                {(canFlag
                                    ? adminFlagReasons
                                    : reportCategories.map(
                                          (name) => [name, name] as const,
                                      )
                                ).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block space-y-1 text-sm">
                            <span>
                                {canFlag
                                    ? 'Penjelasan (opsional)'
                                    : 'Keterangan tambahan (opsional)'}
                            </span>
                            <Textarea
                                maxLength={canFlag ? 1000 : 450}
                                rows={3}
                                value={explanation}
                                disabled={busy}
                                onChange={(event) =>
                                    setExplanation(event.target.value)
                                }
                            />
                        </label>
                        {error && (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {error}
                            </p>
                        )}
                        <div className="flex justify-end gap-2">
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
                                className={primary}
                                disabled={busy || !category}
                            >
                                {busy
                                    ? 'Mengirim...'
                                    : canFlag
                                      ? 'Tandai'
                                      : 'Kirim Laporan'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </section>
    );
}
