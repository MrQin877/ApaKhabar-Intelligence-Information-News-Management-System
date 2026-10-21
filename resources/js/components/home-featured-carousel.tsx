import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';

export interface HomeNews {
    id: string;
    title: string;
    date: string;
    category: string;
    image: string;
    preview: string;
}

export function HomeFeaturedCarousel({ items }: { items: HomeNews[] }) {
    const [active, setActive] = useState(0);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [progress, setProgress] = useState(0);
    const elapsed = useRef(0);
    const lastTick = useRef(0);
    const index = active % Math.max(1, items.length);
    useEffect(() => {
        if (items.length < 2 || hovered || focused) {
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
                setActive((value) => (value + 1) % items.length);
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
    }, [items.length, hovered, focused]);

    if (!items.length) {
        return (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
                Berita pilihan akan hadir di sini.
            </div>
        );
    }

    return (
        <section
            aria-label="Berita pilihan"
            aria-roledescription="carousel"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setFocused(false);
                }
            }}
            className="relative isolate overflow-hidden rounded-2xl bg-background text-white"
        >
            <div className="relative h-[350px] sm:h-[410px] lg:h-[470px]">
                {items.map((item, position) => (
                    <article
                        key={item.id}
                        aria-hidden={position !== index}
                        className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${position === index ? 'z-10 opacity-100' : 'pointer-events-none opacity-0'}`}
                    >
                        {/* Image-derived ambient colors work with local and cross-origin covers. */}
                        <img
                            src={item.image}
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-3xl brightness-[0.25]"
                        />
                        <div
                            className="absolute inset-y-0 right-0 w-[70%]"
                            style={{
                                maskImage:
                                    'radial-gradient(ellipse 100% 150% at 100% 20%, black 57%, rgb(0 0 0 / 0.85) 69%, rgb(0 0 0 / 0.35) 85%, transparent 100%)',
                                WebkitMaskImage:
                                    'radial-gradient(ellipse 100% 150% at 100% 20%, black 57%, rgb(0 0 0 / 0.85) 69%, rgb(0 0 0 / 0.35) 85%, transparent 100%)',
                            }}
                        >
                            <img
                                src={item.image}
                                alt=""
                                className="h-full w-full object-cover object-right"
                                fetchPriority={position === 0 ? 'high' : 'auto'}
                            />
                        </div>
                        <Link
                            href={`/news/${item.id}`}
                            tabIndex={position === index ? 0 : -1}
                            aria-label={item.title}
                            className="absolute inset-0 flex items-end px-6 pt-6 pb-16 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-green-500 sm:px-10 lg:px-14"
                        >
                            <div className="w-full space-y-3 sm:max-w-[75%] lg:max-w-[60%]">
                                <div className="flex flex-wrap items-center gap-3">
                                    <Badge className="border-0 bg-green-600 text-white">
                                        {item.category}
                                    </Badge>
                                    <span className="text-xs text-white/80 sm:text-sm">
                                        {item.date}
                                    </span>
                                </div>
                                <h1 className="max-w-4xl text-2xl leading-tight font-bold sm:text-3xl lg:text-4xl">
                                    <span className="line-clamp-3">
                                        {item.title}
                                    </span>
                                </h1>
                                <p className="line-clamp-2 max-w-3xl text-sm text-white/80 sm:text-base">
                                    {item.preview}
                                </p>
                            </div>
                        </Link>
                    </article>
                ))}
            </div>
            {items.length > 1 && (
                <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-end gap-3 px-5 py-4 sm:px-10">
                    <div
                        className="flex items-center"
                        aria-label="Pilih berita"
                    >
                        {items.map((item, position) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    elapsed.current = 0;
                                    lastTick.current = performance.now();
                                    setProgress(0);
                                    setActive(position);
                                }}
                                aria-label={`Tampilkan ${item.title}`}
                                aria-pressed={position === index}
                                className={`group flex h-9 items-center justify-center rounded-full px-2 transition-[width] focus-visible:outline-2 focus-visible:outline-green-500 ${position === index ? 'w-16' : 'w-9'}`}
                            >
                                <span
                                    className={`h-2 overflow-hidden rounded-full ${position === index ? 'w-12 bg-white/30' : 'w-2 bg-white/50 group-hover:bg-white'}`}
                                >
                                    {position === index && (
                                        <span
                                            className="block h-full w-full origin-left rounded-full bg-green-500"
                                            style={{
                                                transform: `scaleX(${progress})`,
                                            }}
                                        />
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
