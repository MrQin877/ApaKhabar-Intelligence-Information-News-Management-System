import { Head, Link } from '@inertiajs/react';
import { Eye, Play } from 'lucide-react';
import { HeaderBar } from '@/components/header-bar';
import { compactViews } from '@/components/home-shorts';
import { TopShortsCarousel } from '@/components/top-shorts-carousel';
import type { VideoPreview } from '@/components/top-shorts-carousel';
import { Button } from '@/components/ui/button';

type PaginatedShorts = {
    data: VideoPreview[];
    current_page: number;
    last_page: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export default function Videos({
    topShorts,
    shorts,
}: {
    topShorts: VideoPreview[];
    shorts: PaginatedShorts;
}) {
    return (
        <>
            <Head title="Video - ApaKhabar" />
            <div className="min-h-screen bg-background text-foreground">
                <HeaderBar />
                <main className="mx-auto max-w-7xl space-y-16 px-4 py-8 sm:px-6 lg:px-8">
                    <TopShortsCarousel shorts={topShorts} />
                    <section className="space-y-6" aria-label="Jelajahi Shorts">
                        <div>
                            <h2 className="text-2xl font-bold">
                                Jelajahi Shorts
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Video pendek terbaru dari ApaKhabar.
                            </p>
                        </div>
                        {shorts.data.length > 0 ? (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {shorts.data.map((short) => (
                                    <Link
                                        key={short.id}
                                        href={`/shorts/${short.id}`}
                                        className="group min-w-0 space-y-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                    >
                                        <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-secondary">
                                            <img
                                                src={short.thumbnail_url}
                                                alt=""
                                                loading="lazy"
                                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                            <span className="absolute top-3 left-3 rounded-full bg-black/40 p-2 text-white">
                                                <Play
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                            </span>
                                            <span
                                                className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-xs font-medium text-white"
                                                aria-label={`${short.view_count.toLocaleString('id-ID')} tayangan`}
                                            >
                                                <Eye
                                                    className="size-3.5"
                                                    aria-hidden="true"
                                                />
                                                {compactViews(short.view_count)}
                                            </span>
                                        </div>
                                        <h3 className="line-clamp-2 text-sm leading-snug font-semibold transition-colors group-hover:text-primary">
                                            {short.title}
                                        </h3>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="rounded-xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
                                Belum ada video lainnya untuk dijelajahi.
                            </p>
                        )}
                        {shorts.last_page > 1 && (
                            <nav
                                className="flex items-center justify-center gap-3"
                                aria-label="Halaman video"
                            >
                                {shorts.prev_page_url ? (
                                    <Button asChild variant="outline">
                                        <Link
                                            href={shorts.prev_page_url}
                                            preserveScroll
                                        >
                                            Sebelumnya
                                        </Link>
                                    </Button>
                                ) : (
                                    <Button variant="outline" disabled>
                                        Sebelumnya
                                    </Button>
                                )}
                                <span className="text-sm text-muted-foreground">
                                    {shorts.current_page} / {shorts.last_page}
                                </span>
                                {shorts.next_page_url ? (
                                    <Button asChild variant="outline">
                                        <Link
                                            href={shorts.next_page_url}
                                            preserveScroll
                                        >
                                            Berikutnya
                                        </Link>
                                    </Button>
                                ) : (
                                    <Button variant="outline" disabled>
                                        Berikutnya
                                    </Button>
                                )}
                            </nav>
                        )}
                    </section>
                </main>
            </div>
        </>
    );
}
