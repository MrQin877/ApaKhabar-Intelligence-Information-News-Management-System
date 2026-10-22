import '../../css/top-shorts-carousel.css';
import { Link } from '@inertiajs/react';
import { Eye, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { compactViews } from '@/components/home-shorts';

export type VideoPreview = {
    id: number;
    title: string;
    description: string;
    thumbnail_url: string;
    view_count: number;
};

export function TopShortsCarousel({ shorts }: { shorts: VideoPreview[] }) {
    const [active, setActive] = useState(0);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [progress, setProgress] = useState(0);
    const elapsed = useRef(0);
    const lastTick = useRef(0);
    const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const selectedIndex = active % Math.max(shorts.length, 1);
    const current = shorts[selectedIndex];

    useEffect(() => {
        if (shorts.length < 2 || hovered || focused || reducedMotion) {
            return;
        }

        lastTick.current = performance.now();
        const timer = window.setInterval(() => {
            const now = performance.now();
            const delta = now - lastTick.current;
            lastTick.current = now;

            if (document.hidden) {
                return;
            }

            elapsed.current += delta;

            if (elapsed.current >= 5000) {
                elapsed.current = 0;
                setActive((index) => (index + 1) % shorts.length);
            }

            setProgress(elapsed.current / 5000);
        }, 50);

        const resetClock = () => {
            lastTick.current = performance.now();
        };
        document.addEventListener('visibilitychange', resetClock);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', resetClock);
        };
    }, [shorts.length, hovered, focused, reducedMotion]);

    const select = (index: number, timestamp: number) => {
        elapsed.current = 0;
        lastTick.current = timestamp;
        setProgress(0);
        setActive(index);
    };

    if (!current) {
        return (
            <p className="rounded-xl border bg-card px-6 py-12 text-center text-muted-foreground">
                Belum ada video pendek yang diterbitkan.
            </p>
        );
    }

    return (
        <section
            aria-label="Shorts paling banyak ditonton"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setFocused(false);
                }
            }}
            className="space-y-3"
        >
            <div className="space-y-1">
                <h2 className="text-2xl font-bold">Paling Banyak Ditonton</h2>
                <p className="text-sm text-muted-foreground">
                    Video pendek yang paling sering ditonton di ApaKhabar.
                </p>
            </div>
            <div
                className={`grid gap-4 ${shorts.length > 1 ? 'md:h-[520px] md:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] md:grid-rows-2' : 'md:h-[520px]'}`}
            >
                {shorts.map((_, position) => {
                    const short =
                        shorts[(selectedIndex + position) % shorts.length];
                    const featured = position === 0;

                    return (
                        <Link
                            key={`${position}-${short.id}`}
                            href={`/shorts/${short.id}`}
                            aria-label={`Tonton ${short.title}`}
                            className={`top-short-card group relative isolate block min-w-0 overflow-hidden rounded-2xl bg-zinc-900 text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-500 ${featured ? 'h-[380px] md:row-span-2 md:h-full' : `h-[240px] md:h-full ${shorts.length === 2 ? 'md:row-span-2' : ''}`}`}
                        >
                            <img
                                src={short.thumbnail_url}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] group-focus-visible:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
                            />
                            {/* A blurred copy supplies thumbnail colors without CORS-dependent pixel sampling. */}
                            <div className="top-short-ambient pointer-events-none absolute inset-0 opacity-80 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                                <img
                                    src={short.thumbnail_url}
                                    alt=""
                                    aria-hidden="true"
                                    className="h-full w-full scale-110 object-cover blur-2xl brightness-50"
                                />
                            </div>
                            <div className="top-short-shade pointer-events-none absolute inset-0 opacity-85 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
                            <span className="absolute top-4 left-4 rounded-full border border-white/20 bg-black/35 p-2.5 backdrop-blur-sm">
                                <Play
                                    className="size-4 fill-white"
                                    aria-hidden="true"
                                />
                            </span>
                            <div
                                className={`absolute inset-x-0 bottom-0 flex items-end gap-3 text-white/90 transition-colors duration-500 group-hover:text-white group-focus-visible:text-white motion-reduce:transition-none ${featured ? 'p-5 lg:p-7' : 'p-5'}`}
                            >
                                <div className="min-w-0 flex-1 space-y-2 drop-shadow-md">
                                    <h3
                                        className={`line-clamp-2 leading-tight font-bold ${featured ? 'text-2xl lg:text-3xl' : 'text-lg'}`}
                                    >
                                        {short.title}
                                    </h3>
                                    <p className="line-clamp-2 text-sm leading-relaxed text-white/85">
                                        {short.description}
                                    </p>
                                </div>
                                <span
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1.5 text-xs font-medium backdrop-blur-sm"
                                    aria-label={`${short.view_count.toLocaleString('id-ID')} tayangan`}
                                >
                                    <Eye
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {compactViews(short.view_count)}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </div>
            {shorts.length > 1 && (
                <div
                    className="flex items-center justify-center"
                    aria-label="Pilih video populer"
                >
                    {shorts.map((short, index) => (
                        <button
                            key={short.id}
                            type="button"
                            aria-label={`Tampilkan ${short.title}`}
                            aria-pressed={selectedIndex === index}
                            onClick={(event) => select(index, event.timeStamp)}
                            className={`group flex h-9 items-center justify-center rounded-full px-2 transition-[width] focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none ${selectedIndex === index ? 'w-16' : 'w-9'}`}
                        >
                            <span
                                className={`h-2 overflow-hidden rounded-full ${selectedIndex === index ? 'w-12 bg-white/30' : 'w-2 bg-white/50 group-hover:bg-white'}`}
                            >
                                {selectedIndex === index && (
                                    <span
                                        className="block h-full w-full origin-left rounded-full bg-green-500"
                                        style={{
                                            transform: `scaleX(${reducedMotion ? 1 : progress})`,
                                        }}
                                    />
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}
