import { Link, router } from '@inertiajs/react';
import { Eye, Heart, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { csrfPost } from '@/lib/csrf-request';
import { copyArticleLink, visibleReadingClock } from '@/lib/news-engagement';

export interface PublicComment {
    id: string;
    author: string;
    parent_id?: string | null;
    content: string;
    date: string;
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
}
export async function engagementPost(url: string, data: unknown) {
    const response = await csrfPost(url, data);
    const body = await response.json();

    if (!response.ok) {
        throw new Error(
            Object.values(body.errors ?? {})
                .flat()
                .join(' ') ||
                body.message ||
                'Permintaan gagal. Silakan coba lagi.',
        );
    }

    return body;
}

export default function NewsEngagement({
    news,
    comments,
    authenticated,
}: Props) {
    const [prompt, setPrompt] = useState(false);
    const [liked, setLiked] = useState(news.liked_by_user);
    const [likes, setLikes] = useState(news.likes_count);
    const [views, setViews] = useState(news.views);
    const [busy, setBusy] = useState(false);
    const [liking, setLiking] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [message, setMessage] = useState('');
    const [content, setContent] = useState('');
    const [website, setWebsite] = useState('');
    const [challenge, setChallenge] = useState('');
    const [reportId, setReportId] = useState<string | null>(null);
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
        if (!authenticated) {
            setPrompt(true);

            return;
        }

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
            const data = await engagementPost(
                replyId
                    ? `/comments/${replyId}/replies`
                    : `${canonical}/comment`,
                { content, website, challenge },
            );
            setContent('');
            setReplyId(null);
            setMessage(
                data.message ??
                    (data.status === 'published'
                        ? 'Komentar diterbitkan.'
                        : 'Komentar menunggu peninjauan moderator.'),
            );
            router.reload({ only: ['comments'] });
        } catch (error) {
            setMessage((error as Error).message);
        } finally {
            submission.current = false;
            setBusy(false);
        }
    }
    async function report() {
        if (submission.current || !reportReason.trim()) {
            return;
        }

        submission.current = true;
        setBusy(true);

        try {
            const data = await engagementPost(`/comments/${reportId}/report`, {
                reason: reportReason,
            });
            setReportId(null);
            setReportReason('');
            setMessage(data.message);
        } catch (error) {
            setMessage((error as Error).message);
        } finally {
            submission.current = false;
            setBusy(false);
        }
    }
    const button =
        'rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary disabled:opacity-50';

    return (
        <section aria-label="Interaksi berita" className="space-y-6">
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
                    Share
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
                {replyId && (
                    <p>
                        Membalas komentar{' '}
                        <button
                            type="button"
                            className="underline"
                            onClick={() => setReplyId(null)}
                        >
                            Batal
                        </button>
                    </p>
                )}
                <div className="hidden" aria-hidden="true">
                    <label>
                        Website
                        <input
                            tabIndex={-1}
                            autoComplete="off"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                        />
                    </label>
                </div>
                <label className="block text-sm">
                    Komentar
                    <textarea
                        required
                        maxLength={1000}
                        rows={3}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-border bg-background p-3"
                    />
                </label>
                <p className="text-xs text-muted-foreground">
                    Komentar diperiksa otomatis menggunakan OpenAI dan dapat
                    ditinjau moderator sebelum diterbitkan.
                </p>
                <button
                    className="rounded-lg border border-green-600 bg-green-600 px-4 py-2 text-sm text-white enabled:hover:border-green-700 enabled:hover:bg-green-700 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:border-gray-700 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
                    disabled={
                        busy ||
                        !content.trim() ||
                        (!authenticated && !challenge)
                    }
                >
                    {busy ? 'Memproses...' : 'Kirim Komentar'}
                </button>
            </form>
            {comments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    Belum ada komentar. Jadilah yang pertama!
                </p>
            )}
            {comments.map((comment) => (
                <article
                    key={comment.id}
                    className="space-y-2 rounded-xl bg-secondary p-4"
                >
                    <div className="flex flex-wrap gap-3 text-sm">
                        <strong>{comment.author}</strong>
                        <span className="text-muted-foreground">
                            {comment.date}
                        </span>
                    </div>
                    {comment.parent_id && (
                        <p className="text-xs text-muted-foreground">
                            Balasan untuk{' '}
                            {comments.find(
                                (parent) => parent.id === comment.parent_id,
                            )?.author ?? 'komentar'}
                        </p>
                    )}
                    <p className="text-sm break-words whitespace-pre-wrap">
                        {comment.content}
                    </p>
                    {authenticated && (
                        <div className="flex gap-4">
                            <button
                                className="text-xs underline"
                                onClick={() => setReplyId(comment.id)}
                            >
                                Balas
                            </button>
                            <button
                                className="text-xs underline"
                                onClick={() => setReportId(comment.id)}
                            >
                                Laporkan
                            </button>
                        </div>
                    )}
                </article>
            ))}
            <Dialog open={prompt} onOpenChange={setPrompt}>
                <DialogContent>
                    <DialogTitle>Login diperlukan</DialogTitle>
                    <DialogDescription>
                        Please log in or create an account to use this feature.
                    </DialogDescription>
                    <div className="flex justify-end gap-3">
                        <Link
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            href="/login"
                        >
                            Login
                        </Link>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog
                open={reportId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setReportId(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogTitle>Laporkan komentar</DialogTitle>
                    <DialogDescription>
                        Jelaskan mengapa komentar ini perlu ditinjau.
                    </DialogDescription>
                    <textarea
                        aria-label="Alasan laporan"
                        maxLength={500}
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="rounded border p-3"
                    />
                    <button
                        className={button}
                        disabled={busy || !reportReason.trim()}
                        onClick={report}
                    >
                        Kirim laporan
                    </button>
                </DialogContent>
            </Dialog>
        </section>
    );
}
