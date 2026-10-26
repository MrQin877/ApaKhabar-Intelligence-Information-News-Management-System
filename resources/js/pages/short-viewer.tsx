import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowLeft,
    Heart,
    MessageCircle,
    Maximize,
    Pause,
    Play,
    Share2,
    Volume2,
    VolumeX,
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
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { metaRequest } from '@/lib/meta-auth';
import { richTextPlain } from '@/lib/rich-text';
import type { SharedData } from '@/types';

type Short = {
    id: number;
    title: string;
    description: string;
    video_url: string;
    thumbnail_url: string;
    view_count: number;
    likes_count: number;
    published_at: string;
};

type ShortViewerProps = {
    short: Short;
    nextShortId: number | null;
    nextShortPreview?: Pick<Short, 'id' | 'title' | 'thumbnail_url'> | null;
    previousShortId?: number | null;
    commentCount: number;
    likedByUser: boolean;
    canFlagComments: boolean;
};

let pendingTransition: { id: number; panel: 'comments' | 'details' | null } | null = null;
let wheelCooldownUntil = 0;
let preferredMuted = false;
const playerWidth = 'min(460px, max(180px, calc(56.25dvh - 8.75rem)), calc(100vw - 44rem))';
const mobilePlayerWidth = 'min(460px, max(180px, calc(56.25dvh - 8.75rem)), calc(100vw - 5.5rem))';
const detailsAnimation = 'motion-safe:duration-500 motion-safe:ease-in-out';

export default function ShortViewer(props: ShortViewerProps) {
    return <ShortViewerContent key={props.short.id} {...props} />;
}

function ShortViewerContent({
    short,
    nextShortId,
    nextShortPreview,
    previousShortId,
    commentCount,
    likedByUser,
    canFlagComments,
}: ShortViewerProps) {
    const { auth } = usePage<SharedData>().props;
    const authenticated = Boolean(auth.user);
    const player = useRef<HTMLVideoElement>(null);
    const layout = useRef<HTMLElement>(null);
    const commentTrigger = useRef<HTMLButtonElement>(null);
    const commentPanel = useRef<HTMLDivElement>(null);
    const restoreCommentFocus = useRef(false);
    const pausedForComments = useRef(false);
    const resumeAfterComments = useRef(false);
    const swipeStart = useRef<{ x: number; y: number } | null>(null);
    const transitionTimer = useRef<number | null>(null);
    const commentCloseTimer = useRef<number | null>(null);
    const transitionLocked = useRef(false);
    const autoplayNext = useRef(pendingTransition?.id === short.id);
    const token = useRef<string | null>(null);
    const tokenRequest = useRef(false);
    const watched = useRef(0);
    const reported = useRef(false);
    const submitting = useRef(false);
    const [views, setViews] = useState(short.view_count);
    const [likes, setLikes] = useState(short.likes_count);
    const [liked, setLiked] = useState(likedByUser);
    const [comments, setComments] = useState(commentCount);
    const [panel, setPanel] = useState<'comments' | 'details' | null>(
        () => pendingTransition?.id === short.id ? pendingTransition.panel : null,
    );
    const [closingComments, setClosingComments] = useState(false);
    const commentsOpen = panel === 'comments';
    const detailsOpen = panel === 'details';
    const panelOpen = panel !== null;
    const [transitionPhase, setTransitionPhase] = useState<'idle' | 'exiting' | 'entering'>(
        () => pendingTransition?.id === short.id ? 'entering' : 'idle',
    );
    const [wide, setWide] = useState(
        () => typeof window !== 'undefined' && window.innerWidth >= 1080,
    );
    const [visibleViewport, setVisibleViewport] = useState<{
        height: number;
        top: number;
    } | null>(null);
    const [loginPrompt, setLoginPrompt] = useState(false);
    const [liking, setLiking] = useState(false);
    const [likeAnimation, setLikeAnimation] = useState(0);
    const [shareMessage, setShareMessage] = useState('');
    const [engagementError, setEngagementError] = useState('');
    const [muted, setMuted] = useState(preferredMuted);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const onCountChange = useCallback(
        (value: number) => setComments(value),
        [],
    );

    useEffect(() => {
        if (transitionPhase !== 'entering') {
            return;
        }

        pendingTransition = null;

        let secondFrame: number | null = null;
        const firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => setTransitionPhase('idle'));
        });

        return () => {
            window.cancelAnimationFrame(firstFrame);

            if (secondFrame !== null) {
                window.cancelAnimationFrame(secondFrame);
            }
        };
    }, [transitionPhase]);

    useEffect(() => {
        if (!autoplayNext.current) {
            return;
        }

        const timer = window.setTimeout(() => {
            autoplayNext.current = false;

            if (!(panelOpen && !wide)) {
                void player.current?.play().catch(() => {});
            }
        }, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 400);

        return () => window.clearTimeout(timer);
    }, [panelOpen, wide]);

    useEffect(() => {
        if (autoplayNext.current || (panelOpen && !wide)) {
            return;
        }

        const video = player.current;
        if (!video) {
            return;
        }

        void video.play().catch((error: DOMException) => {
            if (error.name === 'NotAllowedError' && !video.muted) {
                video.muted = true;
                setMuted(true);
                void video.play().catch(() => {});
            }
        });

        return () => video.pause();
    }, [short.id]);

    useEffect(() => () => {
        if (transitionTimer.current !== null) {
            window.clearTimeout(transitionTimer.current);
        }
        if (commentCloseTimer.current !== null) {
            window.clearTimeout(commentCloseTimer.current);
        }
    }, []);

    function navigateToShort(id: number) {
        if (transitionLocked.current || id === short.id) {
            return;
        }

        transitionLocked.current = true;
        const wasPlaying = player.current ? !player.current.paused : false;
        player.current?.pause();
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        if (!reducedMotion) {
            setTransitionPhase('exiting');
        }

        const visit = () => {
            pendingTransition = { id, panel };
            const restoreCurrentVideo = () => {
                pendingTransition = null;
                transitionLocked.current = false;
                setTransitionPhase('idle');

                if (wasPlaying && !(panelOpen && !wide)) {
                    void player.current?.play().catch(() => {});
                }
            };

            router.visit(`/shorts/${id}`, {
                onError: restoreCurrentVideo,
                onCancel: restoreCurrentVideo,
            });
        };

        if (reducedMotion) {
            visit();
        } else {
            transitionTimer.current = window.setTimeout(visit, 400);
        }
    }

    useEffect(() => {
        const element = layout.current;

        if (!element) {
            return;
        }

        const measure = () => setWide(element.getBoundingClientRect().width >= 1080);

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure);
            measure();

            return () => window.removeEventListener('resize', measure);
        }

        const observer = new ResizeObserver(measure);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!panelOpen || wide) {
            if (commentsOpen) {
                commentPanel.current?.querySelector<HTMLButtonElement>('[aria-label="Tutup komentar"]')?.focus();
            }

            if (pausedForComments.current) {
                pausedForComments.current = false;

                if (resumeAfterComments.current) {
                    void player.current?.play().catch(() => {});
                }
            }

            return;
        }

        const video = player.current;

        if (video && !pausedForComments.current) {
            resumeAfterComments.current = !video.paused;
            pausedForComments.current = true;
            video.pause();
        }

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const viewport = window.visualViewport;
        const updateViewport = () => setVisibleViewport({
            height: viewport?.height ?? window.innerHeight,
            top: viewport?.offsetTop ?? 0,
        });
        updateViewport();
        viewport?.addEventListener('resize', updateViewport);
        viewport?.addEventListener('scroll', updateViewport);
        commentPanel.current?.querySelector<HTMLButtonElement>('[aria-label="Tutup komentar"]')?.focus();

        return () => {
            document.body.style.overflow = originalOverflow;
            viewport?.removeEventListener('resize', updateViewport);
            viewport?.removeEventListener('scroll', updateViewport);
        };
    }, [panelOpen, commentsOpen, wide]);

    useEffect(() => {
        if (!commentsOpen) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !document.querySelector('[data-slot="dialog-content"][data-state="open"]')) {
                event.preventDefault();
                closeComments();
            }
        };
        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [commentsOpen]);

    useEffect(() => {
        if (!commentsOpen && restoreCommentFocus.current) {
            restoreCommentFocus.current = false;
            commentTrigger.current?.focus();
        }
    }, [commentsOpen]);

    function closeComments() {
        restoreCommentFocus.current = true;
        if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            setClosingComments(true);
            commentCloseTimer.current = window.setTimeout(() => {
                setClosingComments(false);
                commentCloseTimer.current = null;
            }, 500);
        } else {
            setClosingComments(false);
        }
        setPanel(null);
    }

    function openComments() {
        if (commentCloseTimer.current !== null) {
            window.clearTimeout(commentCloseTimer.current);
            commentCloseTimer.current = null;
        }
        setClosingComments(false);
        setPanel('comments');
    }

    function togglePlayback() {
        const video = player.current;

        if (!video) {
            return;
        }

        if (video.paused) {
            void video.play().catch(() => {});
        } else {
            video.pause();
        }
    }

    function toggleMute() {
        const video = player.current;

        if (video) {
            video.muted = !video.muted;
            preferredMuted = video.muted;
            setMuted(preferredMuted);
        }
    }

    function toggleFullscreen() {
        const video = player.current;

        if (!video) {
            return;
        }

        if (document.fullscreenElement && document.exitFullscreen) {
            void document.exitFullscreen();
        } else if (video.parentElement?.requestFullscreen) {
            void video.parentElement.requestFullscreen();
        }
    }

    function onViewerWheel(event: React.WheelEvent<HTMLElement>) {
        if (
            Math.abs(event.deltaY) < 35 ||
            (event.target as HTMLElement).closest('[data-short-panel]') ||
            (layout.current && layout.current.scrollHeight > layout.current.clientHeight + 1)
        ) {
            return;
        }

        const target = event.deltaY > 0 ? nextShortId : previousShortId;

        if (!target) {
            return;
        }

        event.preventDefault();

        if (transitionLocked.current || Date.now() < wheelCooldownUntil) {
            return;
        }

        wheelCooldownUntil = Date.now() + 1000;
        navigateToShort(target);
    }

    function endSwipe(x: number, y: number) {
        const start = swipeStart.current;
        swipeStart.current = null;

        if (!start || Math.abs(y - start.y) < 70 || Math.abs(y - start.y) < Math.abs(x - start.x) * 1.4) {
            return;
        }

        const target = y < start.y ? nextShortId : previousShortId;

        if (target) {
            navigateToShort(target);
        }
    }

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
            setLikeAnimation((value) => value + 1);
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
            className="flex flex-col items-center justify-end gap-5"
            aria-label="Interaksi video pendek"
        >
            <div className="flex flex-col items-center gap-1">
            <Button
                variant="ghost"
                className="size-12 rounded-full border border-white/10 bg-white/5 text-foreground backdrop-blur-sm transition-colors hover:bg-white/15"
                aria-label={`${liked ? 'Batal menyukai' : 'Sukai'} video: ${likes} suka`}
                aria-pressed={liked}
                disabled={liking}
                onClick={() => void like()}
            >
                <Heart
                    key={likeAnimation}
                    className={`size-5 ${liked ? 'text-red-500' : ''} ${likeAnimation > 0 ? 'short-like-pop' : ''}`}
                    fill={liked ? 'currentColor' : 'none'}
                />
            </Button>
            <span className="text-xs">{likes}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
            <Button
                ref={commentTrigger}
                variant="ghost"
                className={`size-12 rounded-full border border-white/10 bg-white/5 text-foreground backdrop-blur-sm transition-colors hover:bg-white/15 ${commentsOpen ? 'border-primary/60 bg-primary/15 text-primary' : ''}`}
                aria-label={`Buka komentar: ${comments} komentar`}
                aria-expanded={commentsOpen}
                onClick={() => commentsOpen ? closeComments() : openComments()}
            >
                <MessageCircle className="size-5" />
            </Button>
            <span className="text-xs">{comments}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
            <Button
                variant="ghost"
                className="size-12 rounded-full border border-white/10 bg-white/5 text-foreground backdrop-blur-sm transition-colors hover:bg-white/15"
                aria-label="Bagikan video"
                onClick={() => void share()}
            >
                <Share2 className="size-5" />
            </Button>
            <span className="text-xs">Bagikan</span>
            </div>
        </div>
    );

    const details = (
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto p-5" data-short-panel>
            <h2 className="pr-8 text-lg font-semibold">{short.title}</h2>
            <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
                <span>{likes.toLocaleString('id-ID')} suka</span>
                <span>{views.toLocaleString('id-ID')} tayangan</span>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
                Terbit {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(short.published_at))}
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{richTextPlain(short.description)}</p>
        </div>
    );

    return (
        <>
            <Head title={`${short.title} — ApaKhabar Shorts`} />
            <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
                <HeaderBar />
                <main
                    ref={layout}
                    onWheel={onViewerWheel}
                    className={`mx-auto flex max-w-7xl flex-col px-3 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 ${wide ? 'h-[calc(100dvh-65px)] overflow-x-hidden overflow-y-auto' : 'min-h-[calc(100dvh-65px)]'}`}
                >
                    <div className="mx-auto flex w-full max-w-full flex-1 flex-col justify-center">
                    <Link
                        href="/#shorts"
                        className={`mb-3 inline-flex min-h-11 w-fit shrink-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary ${commentsOpen && !wide ? 'invisible' : ''}`}
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Kembali ke Shorts
                    </Link>
                    <div
                        className={`${panelOpen && !wide ? 'block' : 'grid items-end justify-center gap-3 sm:gap-5'}`}
                        style={wide ? { gridTemplateColumns: `3.25rem minmax(0, 1fr) ${playerWidth} 3.25rem minmax(0, 1fr)` } : panelOpen ? undefined : { gridTemplateColumns: `${mobilePlayerWidth} 3.25rem` }}
                    >
                        <div className={`min-w-0 max-w-[400px] motion-safe:animate-in motion-safe:fade-in ${detailsAnimation} ${wide ? `col-start-2 row-start-1 self-end border-l-2 border-primary pl-4 ${nextShortPreview ? 'mb-8' : ''}` : 'col-start-1 row-start-2 pt-2'} ${panelOpen && !wide ? 'hidden' : ''}`}>
                            <h1 className="min-w-0">
                                <button type="button" title={short.title} onClick={() => setPanel('details')} className="block max-w-full break-words text-left text-xl leading-tight font-bold text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring sm:text-2xl lg:text-3xl">
                                    {short.title}
                                </button>
                            </h1>
                            {short.description && <button type="button" onClick={() => setPanel('details')} className="mt-2 line-clamp-3 max-w-full break-words text-left text-sm leading-relaxed text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">{richTextPlain(short.description)}</button>}
                            {short.description && (
                                <button type="button" onClick={() => setPanel('details')} className="mt-1 text-left text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                                    Lihat selengkapnya
                                </button>
                            )}
                        </div>
                        <div className={`min-w-0 ${panelOpen && !wide ? 'hidden' : ''} ${wide ? 'col-start-3 row-start-1' : 'col-start-1 row-start-1'}`}>
                        <div
                            className={`relative aspect-[9/16] min-w-0 overflow-hidden rounded-xl bg-black transition-[transform,opacity] duration-[400ms] ease-out motion-reduce:transition-none ${transitionPhase === 'exiting' ? '-translate-y-[8%] opacity-0' : transitionPhase === 'entering' ? 'translate-y-[8%] opacity-0' : 'translate-y-0 opacity-100'} ${!wide ? 'touch-pan-x' : ''}`}
                            style={{ width: '100%' }}
                            onTouchStart={(event) => {
                                swipeStart.current = {
                                    x: event.touches[0].clientX,
                                    y: event.touches[0].clientY,
                                };
                            }}
                            onTouchEnd={(event) => endSwipe(event.changedTouches[0].clientX, event.changedTouches[0].clientY)}
                            onTouchCancel={() => {
                                swipeStart.current = null;
                            }}
                        >
                            <video
                                ref={player}
                                src={short.video_url}
                                poster={short.thumbnail_url}
                                playsInline
                                muted={muted}
                                preload="metadata"
                                onPlay={() => {
                                    startView();
                                    setPlaying(true);
                                }}
                                onPause={() => setPlaying(false)}
                                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
                                onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
                                className="absolute inset-0 h-full w-full bg-black object-contain"
                                aria-label={short.title}
                            />
                            <button
                                type="button"
                                aria-label="Putar atau jeda video"
                                onClick={togglePlayback}
                                className="absolute inset-x-0 top-14 bottom-8 z-10 cursor-pointer focus-visible:outline-2 focus-visible:outline-ring"
                            />
                            <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/75 to-transparent px-3 pt-3 pb-7 text-white">
                                <div className="flex items-center gap-2">
                                    <Button type="button" size="icon" variant="ghost" className="size-10 rounded-full bg-black/35 hover:bg-black/55" aria-label={playing ? 'Jeda video' : 'Putar video'} onClick={togglePlayback}>
                                        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                                    </Button>
                                    <Button type="button" size="icon" variant="ghost" className="size-10 rounded-full bg-black/35 hover:bg-black/55" aria-label={muted ? 'Bunyikan video' : 'Bisukan video'} onClick={toggleMute}>
                                        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                                    </Button>
                                    <Button type="button" size="icon" variant="ghost" className="ml-auto size-10 rounded-full bg-black/35 hover:bg-black/55" aria-label="Layar penuh" onClick={toggleFullscreen}>
                                        <Maximize className="size-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="absolute inset-x-3 bottom-2 z-20">
                                <input type="range" min="0" max={duration || 0} value={progress} step="0.1" aria-label="Posisi video" className="h-2 w-full accent-primary" onChange={(event) => {
                                    if (player.current) {
                                        player.current.currentTime = Number(event.target.value);
                                    }
                                }} />
                            </div>
                        </div>
                        {nextShortPreview && (
                            <div className="mt-3 h-5 overflow-hidden rounded-t-lg opacity-65" aria-hidden="true">
                                <img src={nextShortPreview.thumbnail_url} alt="" className="h-40 w-full object-cover object-top" loading="lazy" />
                            </div>
                        )}
                        </div>
                        <div className={`min-w-0 self-end justify-self-center ${nextShortPreview ? 'mb-8' : ''} ${panelOpen && !wide ? 'hidden' : ''} ${wide ? 'col-start-4 row-start-1' : 'col-start-2 row-start-1'}`}>
                            {engagement}
                            {engagementError && !(commentsOpen && !wide) && (
                                <p
                                    role="alert"
                                    className={`${wide ? 'text-xs' : 'fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm rounded-lg border bg-card p-3 text-xs shadow-lg'} text-destructive`}
                                >
                                    {engagementError}
                                </p>
                            )}
                            {shareMessage && !(commentsOpen && !wide) && (
                                <p
                                    role="status"
                                    className={`${wide ? 'text-xs' : 'fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm rounded-lg border bg-card p-3 text-xs shadow-lg'} text-muted-foreground`}
                                >
                                    {shareMessage}
                                </p>
                            )}
                        </div>
                        {(wide || commentsOpen || closingComments) && (
                            <div
                                ref={commentPanel}
                                className={`${wide ? `col-start-5 row-start-1 min-h-0 min-w-0 w-[calc(100%+1rem)] max-w-[400px] self-stretch overflow-hidden rounded-xl bg-card ${nextShortPreview ? 'mb-8' : ''}` : 'fixed inset-x-0 z-50 min-w-0 bg-background'} ${commentsOpen ? `pointer-events-auto opacity-100 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 ${detailsAnimation}` : closingComments ? `pointer-events-none opacity-0 motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-right-4 ${detailsAnimation}` : 'pointer-events-none opacity-0'}`}
                                data-short-panel
                                style={!wide ? {
                                    top: visibleViewport?.top ?? 0,
                                    height: visibleViewport ? `${visibleViewport.height}px` : '100dvh',
                                } : undefined}
                            >
                                {(commentsOpen || closingComments) && <ShortComments
                                    shortId={short.id}
                                    authenticated={authenticated}
                                    canFlag={canFlagComments}
                                    count={comments}
                                    onCountChange={onCountChange}
                                    onClose={closeComments}
                                    onLogin={() => setLoginPrompt(true)}
                                    fullScreen={!wide}
                                />}
                            </div>
                        )}
                        {detailsOpen && wide && (
                            <section aria-label="Detail video" data-short-panel className={`col-start-5 row-start-1 flex min-h-0 min-w-0 w-full max-w-[400px] flex-col self-stretch overflow-hidden rounded-xl border bg-card animate-in fade-in slide-in-from-right-4 duration-500 ease-in-out motion-reduce:animate-none ${nextShortPreview ? 'mb-8' : ''}`}>
                                <div className="flex items-center justify-between border-b px-5 py-3">
                                    <h2 className="font-semibold">Detail Video</h2>
                                    <Button type="button" size="icon" variant="ghost" className="size-11" aria-label="Tutup detail video" onClick={() => setPanel(null)}>×</Button>
                                </div>
                                {details}
                            </section>
                        )}
                        <div
                            className={`self-center justify-self-center ${panelOpen && !wide ? 'hidden' : ''} ${wide ? 'col-start-4 row-start-1 -translate-y-28' : 'col-start-2 row-start-2 -translate-y-8'}`}
                        >
                            {nextShortId && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                aria-label="Video berikutnya"
                                                disabled={transitionPhase !== 'idle'}
                                                onClick={() => navigateToShort(nextShortId)}
                                                className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                                            >
                                                <ArrowDown
                                                    className="size-5"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                            Video berikutnya
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </div>
                    </div>
                </main>
            </div>
            <Sheet open={detailsOpen && !wide} onOpenChange={(open) => {
                if (!open) {
                    setPanel(null);
                }
            }}>
                <SheetContent side="right" className="w-full max-w-none gap-0 sm:max-w-none" data-short-panel>
                    <SheetHeader className="border-b">
                        <SheetTitle>Detail Video</SheetTitle>
                    </SheetHeader>
                    {details}
                </SheetContent>
            </Sheet>
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
