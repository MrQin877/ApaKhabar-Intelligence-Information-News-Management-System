import { Link, usePage } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    ChevronUp,
    CircleAlert,
    Video,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PlatformIcon } from '@/components/publication-preview';
import { PublishResultDialog } from '@/components/publish-result-dialog';
import { Button } from '@/components/ui/button';
import {
    VideoPublicationIndicator,
    VideoPublicationRing,
} from '@/components/video-publication-indicator';
import type { PublishResult } from '@/lib/manual-publish';
import { metaRequest } from '@/lib/meta-auth';
import { publicationActive } from '@/lib/short-publication';

type TrackedVideo = {
    id: number;
    title: string;
    thumbnail_url?: string | null;
};
const platformOrder = ['website', 'instagram', 'facebook'] as const;
const platformName = {
    website: 'ApaKhabar',
    instagram: 'Instagram Reels',
    facebook: 'Facebook Reels',
};

function persistTracked(key: string, next: TrackedVideo[]) {
    try {
        sessionStorage.setItem(key, JSON.stringify(next));
    } catch {
        /* Keep in memory. */
    }
}

function counts(items: TrackedVideo[], results: Record<number, PublishResult>) {
    const statuses = items.flatMap((item) =>
        platformOrder
            .map((platform) => results[item.id]?.results[platform]?.status)
            .filter((status) => status && status !== 'not_selected'),
    );

    return {
        selected: statuses.length,
        completed: statuses.filter((status) =>
            ['published', 'failed'].includes(status ?? ''),
        ).length,
        failed: statuses.filter((status) => status === 'failed').length,
        uncertain: statuses.filter((status) => status === 'uncertain').length,
    };
}

export function ShortPublicationPanel() {
    const { auth } = usePage<{ auth: { user: { id: number } | null } }>().props;
    const key = `short-publications:${auth.user?.id}`;
    const [items, setItems] = useState<TrackedVideo[]>(() => {
        try {
            const saved = JSON.parse(sessionStorage.getItem(key) ?? '[]');

            if (Array.isArray(saved)) {
                return saved.filter(
                    (v) =>
                        Number.isInteger(v.id) && typeof v.title === 'string',
                );
            }
        } catch {
            /* Optional tab persistence. */
        }

        return [];
    });
    const [results, setResults] = useState<Record<number, PublishResult>>({});
    const [selected, setSelected] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const latest = useRef<Record<number, PublishResult>>({});
    const inFlight = useRef(new Set<number>());
    const [refreshKey, setRefreshKey] = useState(0);
    const removeItem = (id: number) => {
        setItems((previous) => {
            const next = previous.filter((item) => item.id !== id);
            persistTracked(key, next);

            return next;
        });
    };
    useEffect(() => {
        const receive = (event: Event) => {
            const item = (
                event as CustomEvent<{
                    id: number;
                    title: string;
                    thumbnail_url?: string | null;
                    result?: PublishResult;
                    open?: boolean;
                }>
            ).detail;

            if (item.result) {
                latest.current[item.id] = item.result;
                setResults((previous) => ({
                    ...previous,
                    [item.id]: item.result!,
                }));

                if (
                    !publicationActive(item.result) &&
                    Object.values(item.result.results).some((platform) =>
                        ['failed', 'uncertain'].includes(platform.status ?? ''),
                    )
                ) {
                    setMinimized(true);
                }
            } else {
                delete latest.current[item.id];
            }

            if (item.open) {
                setSelected(item.id);
            }

            setItems((previous) => {
                const prior = previous.find((video) => video.id === item.id);
                const next = [
                    ...previous.filter((v) => v.id !== item.id),
                    {
                        id: item.id,
                        title: item.title,
                        thumbnail_url:
                            item.thumbnail_url ?? prior?.thumbnail_url,
                    },
                ];
                persistTracked(key, next);

                return next;
            });
        };
        window.addEventListener('short-publication', receive);

        return () => window.removeEventListener('short-publication', receive);
    }, [key]);
    useEffect(() => {
        let stopped = false;
        const poll = () => {
            if (
                items.every(
                    (item) =>
                        latest.current[item.id] &&
                        !publicationActive(latest.current[item.id]),
                )
            ) {
                window.clearInterval(timer);

                return;
            }

            items.forEach((item) => {
                if (
                    inFlight.current.has(item.id) ||
                    (latest.current[item.id] &&
                        !publicationActive(latest.current[item.id]))
                ) {
                    return;
                }

                inFlight.current.add(item.id);
                void metaRequest<{
                    result: PublishResult;
                    video?: { thumbnail_url?: string | null; title?: string };
                }>(`/admin/short-videos/${item.id}/status`)
                    .then((data) => {
                        if (!stopped) {
                            latest.current[item.id] = data.result;
                            setResults((previous) => ({
                                ...previous,
                                [item.id]: data.result,
                            }));

                            if (
                                !publicationActive(data.result) &&
                                Object.values(data.result.results).some(
                                    (platform) =>
                                        ['failed', 'uncertain'].includes(
                                            platform.status ?? '',
                                        ),
                                )
                            ) {
                                setMinimized(true);
                            }

                            if (data.video?.thumbnail_url) {
                                setItems((previous) => {
                                    const found = previous.find(
                                        (video) => video.id === item.id,
                                    );

                                    if (
                                        !found ||
                                        (found.thumbnail_url ===
                                            data.video?.thumbnail_url &&
                                            found.title ===
                                                (data.video?.title ??
                                                    found.title))
                                    ) {
                                        return previous;
                                    }

                                    const next = previous.map((video) =>
                                        video.id === item.id
                                            ? {
                                                  ...video,
                                                  title:
                                                      data.video?.title ??
                                                      video.title,
                                                  thumbnail_url:
                                                      data.video?.thumbnail_url,
                                              }
                                            : video,
                                    );
                                    persistTracked(key, next);

                                    return next;
                                });
                            }

                            setError('');
                        }
                    })
                    .catch(() => {
                        if (!stopped) {
                            setError('Status belum dapat diperbarui.');
                        }
                    })
                    .finally(() => inFlight.current.delete(item.id));
            });
        };
        const timer = window.setInterval(poll, 5000);
        poll();

        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, [items, refreshKey, key]);

    useEffect(() => {
        const finished = items.filter((item) => {
            const result = results[item.id];
            const selectedStatuses =
                result &&
                platformOrder
                    .map((platform) => result.results[platform]?.status)
                    .filter((status) => status && status !== 'not_selected');

            return (
                result &&
                !publicationActive(result) &&
                selectedStatuses?.length &&
                selectedStatuses.every((status) => status === 'published')
            );
        });
        const timers = finished.map((item) =>
            window.setTimeout(() => {
                setItems((previous) => {
                    const next = previous.filter(
                        (video) => video.id !== item.id,
                    );
                    persistTracked(key, next);

                    return next;
                });
            }, 5000),
        );

        return () => timers.forEach((timer) => window.clearTimeout(timer));
    }, [items, results, key]);

    const activeCount = items.filter((item) =>
        publicationActive(results[item.id]),
    ).length;
    const total = counts(items, results);
    const allSuccessful =
        items.length > 0 &&
        activeCount === 0 &&
        total.failed === 0 &&
        total.uncertain === 0 &&
        total.selected > 0;
    const hasAttention = total.failed > 0 || total.uncertain > 0;

    if (!items.length) {
        return null;
    }

    return (
        <>
            <aside
                hidden={selected !== null}
                aria-label="Status publikasi video"
                className="fixed right-4 bottom-4 z-40 max-h-[min(32rem,calc(100dvh-2rem))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border/80 bg-card/95 p-4 shadow-2xl backdrop-blur-sm"
            >
                {allSuccessful ? (
                    <div className="space-y-2" role="status">
                        <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                                <Check className="size-5" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="text-sm font-semibold">
                                    Publikasi selesai
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {total.completed} platform berhasil
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelected(items[0].id)}
                        >
                            Lihat Detail
                        </Button>
                    </div>
                ) : minimized ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            {activeCount > 0 ? (
                                <VideoPublicationRing />
                            ) : (
                                <CircleAlert
                                    className="size-4 shrink-0 text-destructive"
                                    aria-hidden="true"
                                />
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">
                                    Publikasi Video ({activeCount})
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {total.failed
                                        ? `${total.failed} platform gagal · `
                                        : ''}
                                    {total.selected
                                        ? `${total.completed} dari ${total.selected} platform selesai`
                                        : 'Memuat status...'}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Perluas status publikasi"
                                aria-expanded={false}
                                onClick={() => setMinimized(false)}
                            >
                                <ChevronUp className="size-4" />
                            </Button>
                        </div>
                        {hasAttention && activeCount === 0 && (
                            <div className="flex items-center justify-between gap-2 border-t pt-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setSelected(
                                            items.find(
                                                (item) =>
                                                    results[item.id]?.results &&
                                                    platformOrder.some(
                                                        (platform) =>
                                                            [
                                                                'failed',
                                                                'uncertain',
                                                            ].includes(
                                                                results[item.id]
                                                                    .results[
                                                                    platform
                                                                ]?.status ?? '',
                                                            ),
                                                    ),
                                            )?.id ?? items[0].id,
                                        )
                                    }
                                >
                                    Lihat Detail
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        items.forEach((item) =>
                                            removeItem(item.id),
                                        )
                                    }
                                >
                                    Tutup
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">
                                Publikasi Video ({activeCount})
                            </p>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Minimalkan status publikasi"
                                aria-expanded
                                onClick={() => setMinimized(true)}
                            >
                                <ChevronDown className="size-4" />
                            </Button>
                        </div>
                        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3"
                                >
                                    <div className="flex gap-3">
                                        {item.thumbnail_url ? (
                                            <img
                                                src={item.thumbnail_url}
                                                alt=""
                                                className="h-14 w-10 shrink-0 rounded-md object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                                <Video
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                            </span>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="line-clamp-2 text-sm font-medium">
                                                {item.title}
                                            </p>
                                            {!results[item.id] && (
                                                <p className="text-xs text-muted-foreground">
                                                    Memuat status...
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {platformOrder.map((platform) => {
                                        const status =
                                            results[item.id]?.results[platform]
                                                ?.status;

                                        return (
                                            status &&
                                            status !== 'not_selected' && (
                                                <div
                                                    key={platform}
                                                    className="flex items-center gap-2 text-xs"
                                                >
                                                    <PlatformIcon
                                                        platform={platform}
                                                    />
                                                    <span className="min-w-0 flex-1 truncate">
                                                        {platformName[platform]}
                                                    </span>
                                                    {status === 'queued' ? (
                                                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                                            <span
                                                                className="size-2 rounded-full bg-muted-foreground/60"
                                                                aria-hidden="true"
                                                            />
                                                            Menunggu
                                                        </span>
                                                    ) : (
                                                        <VideoPublicationIndicator
                                                            status={status}
                                                        />
                                                    )}
                                                </div>
                                            )
                                        );
                                    })}
                                    <div className="flex items-center justify-between gap-2 pt-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelected(item.id)}
                                        >
                                            Lihat Detail
                                        </Button>
                                        {!publicationActive(results[item.id]) &&
                                            platformOrder.some((platform) =>
                                                [
                                                    'failed',
                                                    'uncertain',
                                                ].includes(
                                                    results[item.id]?.results[
                                                        platform
                                                    ]?.status ?? '',
                                                ),
                                            ) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Tutup status ${item.title}`}
                                                    onClick={() =>
                                                        removeItem(item.id)
                                                    }
                                                >
                                                    <X className="size-3.5" />
                                                </Button>
                                            )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {total.selected > 0 && (
                            <div className="space-y-1.5 border-t pt-3">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Progres platform</span>
                                    <span>
                                        {total.completed} dari {total.selected}{' '}
                                        selesai
                                    </span>
                                </div>
                                <div
                                    role="progressbar"
                                    aria-label="Platform selesai"
                                    aria-valuemin={0}
                                    aria-valuemax={total.selected}
                                    aria-valuenow={total.completed}
                                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                                >
                                    <div
                                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                                        style={{
                                            width: `${(total.completed / total.selected) * 100}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                        {error && (
                            <div
                                role="alert"
                                className="flex items-center justify-between gap-2 text-xs text-destructive"
                            >
                                <span>{error}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        latest.current = {};
                                        setRefreshKey((value) => value + 1);
                                    }}
                                >
                                    Perbarui Status
                                </Button>
                            </div>
                        )}
                        <Link
                            href="/admin/short-videos"
                            className="block text-right text-xs font-medium text-primary"
                        >
                            Lihat Daftar Video
                        </Link>
                    </div>
                )}
            </aside>
            {selected && !results[selected] && (
                <div
                    role="status"
                    className="fixed right-4 bottom-4 z-40 rounded-lg border bg-card p-4 text-sm"
                >
                    {error || 'Memuat status publikasi...'}
                    <Button
                        variant="ghost"
                        onClick={() => {
                            latest.current = {};
                            setRefreshKey((value) => value + 1);
                        }}
                    >
                        Perbarui Status
                    </Button>
                    <Button variant="ghost" onClick={() => setSelected(null)}>
                        Tutup
                    </Button>
                </div>
            )}
            {selected && results[selected] && (
                <PublishResultDialog
                    key={selected}
                    videoMode
                    result={results[selected]}
                    retrying={busy}
                    statusError={error}
                    onRefreshStatus={() => {
                        latest.current = {};
                        setRefreshKey((value) => value + 1);
                    }}
                    onDismiss={() => {
                        setSelected(null);
                        setMinimized(false);
                    }}
                    onRetry={(platform) => {
                        if (busy) {
                            return;
                        }

                        setBusy(true);
                        void metaRequest<{ result: PublishResult }>(
                            `/admin/short-videos/${selected}/retry/${platform}`,
                            {},
                        )
                            .then((data) => {
                                latest.current[selected] = data.result;
                                setRefreshKey((value) => value + 1);
                                setResults((previous) => ({
                                    ...previous,
                                    [selected]: data.result,
                                }));
                            })
                            .catch(() =>
                                setError(
                                    'Publikasi belum dapat dicoba kembali.',
                                ),
                            )
                            .finally(() => setBusy(false));
                    }}
                />
            )}
        </>
    );
}
