import '../../css/top-shorts-carousel.css';
import { Link } from '@inertiajs/react';
import { Eye, Play } from 'lucide-react';
import { compactViews } from '@/components/home-shorts';

export type VideoPreview = {
    id: number;
    title: string;
    description: string;
    thumbnail_url: string;
    view_count: number;
};

export function TopShortsCarousel({ shorts }: { shorts: VideoPreview[] }) {
    if (!shorts.length) {
        return (
            <p className="rounded-xl border bg-card px-6 py-12 text-center text-muted-foreground">
                Belum ada video pendek yang diterbitkan.
            </p>
        );
    }

    return (
        <section
            aria-label="Shorts paling banyak ditonton"
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
                {shorts.slice(0, 3).map((short, position) => {
                    const featured = position === 0;

                    return (
                        <Link
                            key={short.id}
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
                            <span className="absolute top-4 right-4 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                                No. {position + 1}
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
        </section>
    );
}
