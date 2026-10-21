import { Link, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PublishResultDialog } from '@/components/publish-result-dialog';
import { Button } from '@/components/ui/button';
import { VideoPublicationIndicator } from '@/components/video-publication-indicator';
import type { PublishResult } from '@/lib/manual-publish';
import { metaRequest } from '@/lib/meta-auth';
import { publicationActive } from '@/lib/short-publication';

export function ShortPublicationPanel() {
    const { auth } = usePage<{ auth: { user: { id: number } | null } }>().props;
    const key = `short-publications:${auth.user?.id}`;
    const [items, setItems] = useState<{ id: number; title: string }[]>(() => {
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
    const [minimized, setMinimized] = useState(true);
    const latest = useRef<Record<number, PublishResult>>({});
    const inFlight = useRef(new Set<number>());
    const [refreshKey, setRefreshKey] = useState(0);
    useEffect(() => {
        const receive = (event: Event) => {
            const item = (
                event as CustomEvent<{
                    id: number;
                    title: string;
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
            } else {
                delete latest.current[item.id];
            }

            if (item.open) {
                setSelected(item.id);
            }

            setItems((previous) => {
                const next = [
                    ...previous.filter((v) => v.id !== item.id),
                    { id: item.id, title: item.title },
                ];

                try {
                    sessionStorage.setItem(key, JSON.stringify(next));
                } catch {
                    /* Keep in memory. */
                }

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
                void metaRequest<{ result: PublishResult }>(
                    `/admin/short-videos/${item.id}/status`,
                )
                    .then((data) => {
                        if (!stopped) {
                            latest.current[item.id] = data.result;
                            setResults((previous) => ({
                                ...previous,
                                [item.id]: data.result,
                            }));
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
    }, [items, refreshKey]);

    if (!items.length) {
        return null;
    }

    return (
        <>
            <aside
                hidden={selected !== null}
                aria-label="Status publikasi video"
                className="fixed right-4 bottom-4 z-40 max-h-64 w-80 max-w-[calc(100vw-2rem)] space-y-3 overflow-y-auto rounded-xl border bg-card p-4 shadow-lg"
            >
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                        {minimized
                            ? `${items.filter((item) => publicationActive(results[item.id])).length} publikasi diproses`
                            : 'Publikasi Video'}
                    </p>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={
                            minimized
                                ? 'Perluas status publikasi'
                                : 'Minimalkan status publikasi'
                        }
                        aria-expanded={!minimized}
                        onClick={() => setMinimized(!minimized)}
                    >
                        {minimized ? (
                            <ChevronUp className="size-4" />
                        ) : (
                            <ChevronDown className="size-4" />
                        )}
                    </Button>
                </div>
                {!minimized && (
                    <>
                        {items.map((item) => (
                            <div key={item.id} className="space-y-1 text-xs">
                                <p className="truncate font-medium">
                                    {item.title}
                                </p>
                                {!results[item.id] && <p>Memuat status...</p>}
                                {Object.entries(
                                    results[item.id]?.results ?? {},
                                ).map(
                                    ([platform, value]) =>
                                        value.status !== 'not_selected' && (
                                            <p
                                                key={platform}
                                                className="flex flex-wrap items-center gap-1"
                                            >
                                                {platform === 'website'
                                                    ? 'ApaKhabar'
                                                    : platform === 'instagram'
                                                      ? 'Instagram Reels'
                                                      : 'Facebook Reels'}
                                                :{' '}
                                                <VideoPublicationIndicator
                                                    status={value.status}
                                                />
                                            </p>
                                        ),
                                )}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelected(item.id)}
                                    >
                                        Lihat Detail
                                    </Button>
                                    {!publicationActive(results[item.id]) && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setItems((previous) => {
                                                    const next =
                                                        previous.filter(
                                                            (v) =>
                                                                v.id !==
                                                                item.id,
                                                        );

                                                    try {
                                                        sessionStorage.setItem(
                                                            key,
                                                            JSON.stringify(
                                                                next,
                                                            ),
                                                        );
                                                    } catch {
                                                        /* Optional. */
                                                    }

                                                    return next;
                                                })
                                            }
                                        >
                                            Tutup
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {error && (
                            <p
                                role="alert"
                                className="text-xs text-destructive"
                            >
                                {error}
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
                            </p>
                        )}
                        <Link
                            href="/admin/short-videos"
                            className="text-xs text-primary"
                        >
                            Lihat Daftar Video
                        </Link>
                    </>
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
