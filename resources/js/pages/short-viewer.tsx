import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowLeft,
    Eye,
    Heart,
    MessageCircle,
    Share2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HeaderBar } from '@/components/header-bar';
import { ShortComments } from '@/components/short-comments';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { metaRequest } from '@/lib/meta-auth';
import type { SharedData } from '@/types';

type Short = {
    id: number;
    title: string;
    description: string;
    video_url: string;
    thumbnail_url: string;
    view_count: number;
    likes_count: number;
};

export default function ShortViewer({
    short,
    nextShortId,
    commentCount,
    likedByUser,
    canFlagComments,
}: {
    short: Short;
    nextShortId: number | null;
    commentCount: number;
    likedByUser: boolean;
    canFlagComments: boolean;
}) {
    const { auth } = usePage<SharedData>().props;
    const authenticated = Boolean(auth.user);
    const player = useRef<HTMLVideoElement>(null);
    const token = useRef<string | null>(null);
    const tokenRequest = useRef(false);
    const watched = useRef(0);
    const reported = useRef(false);
    const submitting = useRef(false);
    const [views, setViews] = useState(short.view_count);
    const [likes, setLikes] = useState(short.likes_count);
    const [liked, setLiked] = useState(likedByUser);
    const [comments, setComments] = useState(commentCount);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [loginPrompt, setLoginPrompt] = useState(false);
    const [liking, setLiking] = useState(false);
    const [shareMessage, setShareMessage] = useState('');
    const [engagementError, setEngagementError] = useState('');
    const onCountChange = useCallback(
        (value: number) => setComments(value),
        [],
    );

    useEffect(() => {
        let last = performance.now();
        const timer = window.setInterval(() => {
            const now = performance.now();
            const video = player.current;

            if (
                token.current &&
                video &&
                !video.paused &&
                !video.ended &&
                video.readyState >= 2 &&
                document.visibilityState === 'visible'
            ) {
                watched.current += Math.min((now - last) / 1000, 0.5);
            }

            last = now;

            if (
                watched.current >= 5 &&
                token.current &&
                !reported.current &&
                !submitting.current
            ) {
                submitting.current = true;
                void metaRequest<{ view_count: number }>(
                    `/shorts/${short.id}/view`,
                    { token: token.current },
                )
                    .then((response) => {
                        reported.current = true;
                        setViews(response.view_count);
                    })
                    .catch(() => {
                        // Playback must remain available when analytics fails.
                        reported.current = true;
                    })
                    .finally(() => {
                        submitting.current = false;
                    });
            }
        }, 250);

        return () => window.clearInterval(timer);
    }, [short.id]);

    const startView = () => {
        if (token.current || tokenRequest.current || reported.current) {
            return;
        }

        tokenRequest.current = true;
        void metaRequest<{ token: string }>(`/shorts/${short.id}/view-token`)
            .then((response) => {
                token.current = response.token;
            })
            .catch(() => {
                // A later play can request a fresh challenge.
            })
            .finally(() => {
                tokenRequest.current = false;
            });
    };

    async function like() {
        if (!authenticated) {
            setLoginPrompt(true);

            return;
        }

        if (liking) {
            return;
        }

        setLiking(true);

        try {
            const result = await metaRequest<{
                liked: boolean;
                likes_count: number;
            }>(`/shorts/${short.id}/like`, {});
            setLiked(result.liked);
            setLikes(result.likes_count);
            setEngagementError('');
        } catch (caught) {
            setEngagementError((caught as Error).message);
        } finally {
            setLiking(false);
        }
    }

    async function share() {
        try {
            await navigator.clipboard.writeText(
                new URL(`/shorts/${short.id}`, window.location.origin).href,
            );
            setShareMessage('Tautan berhasil disalin!');
        } catch {
            setShareMessage(
                'Tidak dapat menyalin tautan. Salin alamat halaman dari browser.',
            );
        }
    }

    const engagement = (
        <div
            className={`hidden gap-3 lg:flex ${commentsOpen ? 'lg:flex-col' : ''}`}
            aria-label="Interaksi video pendek"
        >
            <Button
                variant="ghost"
                className="flex flex-col gap-1"
                aria-label={`${liked ? 'Batal menyukai' : 'Sukai'} video: ${likes} suka`}
                aria-pressed={liked}
                disabled={liking}
                onClick={() => void like()}
            >
                <Heart
                    className="size-5"
                    fill={liked ? 'currentColor' : 'none'}
                />
                <span className="text-xs">{likes}</span>
            </Button>
            <Button
                variant="ghost"
                className="hidden flex-col gap-1 lg:flex"
                aria-label={`Buka komentar: ${comments} komentar`}
                aria-expanded={commentsOpen}
                onClick={() => setCommentsOpen((open) => !open)}
            >
                <MessageCircle className="size-5" />
                <span className="text-xs">{comments}</span>
            </Button>
            <Button
                variant="ghost"
                className="flex flex-col gap-1"
                aria-label="Bagikan video"
                onClick={() => void share()}
            >
                <Share2 className="size-5" />
                <span className="text-xs">Bagikan</span>
            </Button>
        </div>
    );

    const details = (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">{short.title}</h1>
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="size-4" aria-hidden="true" />
                {views.toLocaleString('id-ID')} tayangan
            </p>
            {short.description && (
                <p className="leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {short.description}
                </p>
            )}
        </div>
    );

    return (
        <>
            <Head title={`${short.title} — ApaKhabar Shorts`} />
            <div className="min-h-screen bg-background text-foreground">
                <HeaderBar />
                <main
                    className={`mx-auto px-4 py-8 sm:px-6 ${commentsOpen ? 'max-w-7xl' : 'max-w-5xl'}`}
                >
                    <Link
                        href="/#shorts"
                        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Kembali ke Shorts
                    </Link>
                    <div
                        className={`grid gap-6 md:grid-cols-[minmax(0,360px)_1fr] md:items-start ${commentsOpen ? 'lg:grid-cols-[minmax(0,360px)_3.5rem_minmax(0,380px)_3.5rem]' : ''}`}
                    >
                        <div className="min-w-0 space-y-5">
                            <video
                                ref={player}
                                src={short.video_url}
                                poster={short.thumbnail_url}
                                controls
                                playsInline
                                preload="metadata"
                                onPlay={startView}
                                className="aspect-[9/16] w-full rounded-xl bg-black object-contain"
                                aria-label={short.title}
                            />
                            {commentsOpen && (
                                <div className="hidden lg:block">{details}</div>
                            )}
                        </div>
                        <div
                            className={`min-w-0 space-y-5 ${commentsOpen ? 'lg:pt-20' : ''}`}
                        >
                            <div className={commentsOpen ? 'lg:hidden' : ''}>
                                {details}
                            </div>
                            {engagement}
                            {engagementError && (
                                <p
                                    role="alert"
                                    className="text-xs text-destructive"
                                >
                                    {engagementError}
                                </p>
                            )}
                            {shareMessage && (
                                <p
                                    role="status"
                                    className="text-xs text-muted-foreground"
                                >
                                    {shareMessage}
                                </p>
                            )}
                            {!commentsOpen && nextShortId && (
                                <Link
                                    href={`/shorts/${nextShortId}`}
                                    className="hidden items-center gap-2 text-sm text-primary lg:inline-flex"
                                >
                                    Video berikutnya{' '}
                                    <ArrowDown className="size-4" />
                                </Link>
                            )}
                        </div>
                        {commentsOpen && (
                            <div className="hidden min-w-0 lg:block">
                                <ShortComments
                                    shortId={short.id}
                                    authenticated={authenticated}
                                    canFlag={canFlagComments}
                                    count={comments}
                                    onCountChange={onCountChange}
                                    onClose={() => setCommentsOpen(false)}
                                    onLogin={() => setLoginPrompt(true)}
                                />
                            </div>
                        )}
                        {commentsOpen && (
                            <div className="hidden self-center justify-self-end lg:block">
                                {nextShortId && (
                                    <Link
                                        href={`/shorts/${nextShortId}`}
                                        aria-label="Video berikutnya"
                                        className="flex size-12 items-center justify-center rounded-full border bg-secondary transition-colors hover:bg-accent"
                                    >
                                        <ArrowDown className="size-5" />
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
            <Dialog open={loginPrompt} onOpenChange={setLoginPrompt}>
                <DialogContent>
                    <DialogTitle>Masuk diperlukan</DialogTitle>
                    <DialogDescription>
                        Silakan masuk atau buat akun untuk menggunakan fitur
                        ini.
                    </DialogDescription>
                    <div className="flex justify-end">
                        <Link
                            href="/login"
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                        >
                            Masuk
                        </Link>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
