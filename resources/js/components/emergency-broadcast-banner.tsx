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

    if (!active.length) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <section
                aria-label="Siaran Darurat"
                className="emergency-banner flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-red-400/40 bg-red-700/90 p-3 text-white shadow-md shadow-red-950/15 backdrop-blur-sm sm:flex-nowrap sm:gap-4 sm:px-5"
                data-paused={open}
            >
                <h2 className="flex shrink-0 items-center gap-2 text-sm font-bold sm:border-r sm:border-white/30 sm:pr-4 sm:text-base">
                    <Siren aria-hidden="true" className="size-6" />
                    Siaran Darurat
                </h2>
                <div className="order-3 w-full min-w-0 overflow-hidden sm:order-none sm:w-auto sm:flex-1">
                    <div
                        className="emergency-ticker flex w-max"
                        style={{
                            animationDuration: `${Math.max(25, active.reduce((length, item) => length + item.title.length + item.message.length, 0) / 5)}s`,
                        }}
                    >
                        {[0, 1].map((copy) => (
                            <div
                                key={copy}
                                aria-hidden={copy === 1 ? true : undefined}
                                className="flex shrink-0 items-center"
                            >
                                {active.map((item) => (
                                    <span
                                        key={item.id}
                                        className="inline-flex items-center gap-3 pr-10 text-sm whitespace-nowrap"
                                    >
                                        <span aria-hidden="true">•</span>
                                        <strong>{item.title}:</strong>{' '}
                                        {item.message.replace(/\s+/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <DialogTrigger asChild>
                    <Button
                        size="sm"
                        className="ml-auto shrink-0 bg-white text-red-800 shadow-sm hover:bg-red-50"
                    >
                        Lihat Detail
                        <ChevronRight aria-hidden="true" className="size-4" />
                    </Button>
                </DialogTrigger>
            </section>
            <DialogContent
                closeLabel="Tutup"
                className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 pr-5 text-red-700">
                        <Siren aria-hidden="true" className="size-5" />
                        Siaran Darurat
                    </DialogTitle>
                    <DialogDescription>
                        Informasi darurat terbaru untuk warga.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                    {active.map((item) => (
                        <article
                            key={item.id}
                            className="space-y-3 border-t pt-4"
                        >
                            <h3 className="text-lg font-semibold break-words">
                                {item.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Dipublikasikan pada{' '}
                                <time dateTime={item.publishedAt}>
                                    {new Intl.DateTimeFormat('id-ID', {
                                        dateStyle: 'long',
                                        timeStyle: 'short',
                                    }).format(new Date(item.publishedAt))}{' '}
                                    (waktu setempat)
                                </time>
                            </p>
                            <p className="break-words whitespace-pre-wrap">
                                {item.message}
                            </p>
                        </article>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
