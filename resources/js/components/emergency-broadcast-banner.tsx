import { ChevronRight, Siren } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

export interface EmergencyBroadcast {
    id: string;
    title: string;
    message: string;
    publishedAt: string;
    expiresAt: string;
}

export function EmergencyBroadcastBanner({
    broadcasts,
}: {
    broadcasts: EmergencyBroadcast[];
}) {
    const [updates, setItems] = useState<EmergencyBroadcast[] | null>(null);
    const items = updates ?? broadcasts;
    const [now, setNow] = useState(() => Date.now());
    const [open, setOpen] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        const refresh = async () => {
            try {
                const response = await fetch('/api/broadcasts/darurat', {
                    signal: controller.signal,
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                });

                if (response.ok) {
                    setNow(Date.now());
                    const data = await response.json();

                    if (Array.isArray(data.broadcasts)) {
                        setItems(data.broadcasts);
                    }
                }
            } catch {
                /* Keep the last response; local expiry still applies. */
            }
        };
        const timer = window.setInterval(() => {
            void refresh();
        }, 30000);

        return () => {
            controller.abort();
            window.clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        const nextExpiry = Math.min(
            ...items
                .map((item) => Date.parse(item.expiresAt))
                .filter((expiry) => expiry > Date.now()),
        );

        if (!Number.isFinite(nextExpiry)) {
            return;
        }

        const timer = window.setTimeout(
            () => setNow(Date.now()),
            Math.max(0, nextExpiry - Date.now()),
        );

        return () => window.clearTimeout(timer);
    }, [items, now]);

    const active = items.filter(
        (item) =>
            Date.parse(item.expiresAt) > now &&
            Date.parse(item.publishedAt) <= now,
    );

    const current = active.find((item) => item.id === currentId) ?? active[0];
    const activeIds = active.map((item) => item.id).join(',');
    const paused = open || hovered || focused;
    const duration = Math.max(20, (current?.message.length ?? 0) / 5);

    // CSS iterations advance the title and message together after a full loop.
    // Reduced-motion users get a stationary message and a timed rotation instead.
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        let timer: number | undefined;
        const configure = () => {
            window.clearInterval(timer);

            if (media.matches && !paused && activeIds) {
                const ids = activeIds.split(',');
                timer = window.setInterval(() => {
                    setCurrentId(
                        (id) =>
                            ids[
                                (Math.max(0, ids.indexOf(id ?? ids[0])) + 1) %
                                    ids.length
                            ],
                    );
                }, duration * 1000);
            }
        };
        configure();
        media.addEventListener('change', configure);

        return () => {
            window.clearInterval(timer);
            media.removeEventListener('change', configure);
        };
    }, [activeIds, duration, paused]);

    if (!current) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <section
                aria-label="Siaran Darurat"
                className="emergency-banner grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl border border-red-400/40 bg-red-700/90 p-3 text-white shadow-md shadow-red-950/15 backdrop-blur-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:gap-4 sm:px-5"
                data-paused={paused}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onFocusCapture={() => setFocused(true)}
                onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
setFocused(false);
}
                }}
            >
                <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold sm:border-r sm:border-white/30 sm:pr-4 sm:text-base">
                    <Siren aria-hidden="true" className="size-6 shrink-0" />
                    <span className="min-w-0 truncate" title={current.title}>
                        {current.title}
                    </span>
                </h2>
                <div className="[container-type:inline-size] col-span-2 row-start-2 min-w-0 overflow-hidden sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <div
                        key={`${current.id}:${current.message}`}
                        className="emergency-ticker flex w-max"
                        style={{ animationDuration: `${duration}s` }}
                        onAnimationIteration={() => {
                            if (!paused) {
                                setCurrentId(
                                    active[
                                        (active.findIndex(
                                            (item) => item.id === current.id,
                                        ) +
                                            1) %
                                            active.length
                                    ].id,
                                );
                            }
                        }}
                    >
                        {[0, 1].map((copy) => (
                            <div
                                key={copy}
                                aria-hidden={copy === 1 ? true : undefined}
                                className="min-w-[100cqw] shrink-0 pr-10 text-sm whitespace-nowrap"
                            >
                                {current.message.replace(/\s+/g, ' ')}
                            </div>
                        ))}
                    </div>
                </div>
                <DialogTrigger asChild>
                    <Button
                        size="sm"
                        className="col-start-2 row-start-1 shrink-0 bg-white text-red-800 shadow-sm hover:bg-red-50 sm:col-start-3"
                    >
                        Lihat Detail
                        <ChevronRight aria-hidden="true" className="size-4" />
                    </Button>
                </DialogTrigger>
            </section>
            <DialogContent
                closeLabel="Tutup"
                className="max-h-[80vh] max-h-[80dvh] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-2xl"
            >
                <DialogHeader className="min-w-0 pr-6 [overflow-wrap:anywhere]">
                    <DialogTitle className="leading-relaxed break-words text-red-700">
                        {current.title}
                    </DialogTitle>
                    <DialogDescription>
                        Siaran Darurat. Dipublikasikan pada{' '}
                        <time dateTime={current.publishedAt}>
                            {new Intl.DateTimeFormat('id-ID', {
                                dateStyle: 'long',
                                timeStyle: 'short',
                            }).format(new Date(current.publishedAt))}{' '}
                            (waktu setempat)
                        </time>
                    </DialogDescription>
                </DialogHeader>
                <div
                    role="region"
                    aria-label="Isi siaran darurat"
                    tabIndex={0}
                    className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain pr-2 [overflow-wrap:anywhere]"
                >
                    <p className="min-w-0 break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {current.message}
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
