import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { EmergencyBroadcastBanner } from '@/components/emergency-broadcast-banner';
import type { EmergencyBroadcast } from '@/components/emergency-broadcast-banner';
import { HeaderBar } from '@/components/header-bar';
import { HomeFeaturedCarousel } from '@/components/home-featured-carousel';
import type { HomeShort } from '@/components/home-shorts';
import { HomeShorts } from '@/components/home-shorts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { observeHomeReveals } from '@/lib/home-reveal';
import type { SharedData } from '@/types';

interface NewsItem {
    id: string;
    title: string;
    date: string;
    category: string;
    image: string;
    preview: string;
}

interface Props {
    shorts?: HomeShort[];
    featuredSlides: NewsItem[];
    supportingNews: NewsItem[];
    remainingNews: NewsItem[];
    emergencyBroadcasts?: EmergencyBroadcast[];
}

export default function Welcome({
    shorts = [],
    featuredSlides = [],
    supportingNews = [],
    remainingNews = [],
    emergencyBroadcasts = [],
}: Props) {
    const { categories = [] } = usePage<SharedData>().props;
    const [category, setCategory] = useState<string | null>(null);
    const filteredNews = remainingNews.filter(
        (news) => !category || news.category === category,
    );
    const mainRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (mainRef.current) {
            return observeHomeReveals(mainRef.current);
        }
    }, []);

    return (
        <>
            <Head title="ApaKhabar - Berita Terkini">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=inter:400,500,600,700"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen bg-background text-foreground">
                <HeaderBar />

                <main
                    ref={mainRef}
                    className="mx-auto max-w-7xl space-y-12 px-4 py-6 sm:px-6 lg:space-y-24 lg:px-8"
                >
                    <div className="space-y-5">
                        <EmergencyBroadcastBanner
                            broadcasts={emergencyBroadcasts}
                        />
                        <div data-home-reveal>
                            <HomeFeaturedCarousel items={featuredSlides} />
                        </div>
                        {supportingNews.length > 0 && (
                            <section
                                aria-label="Berita pilihan lainnya"
                                className="grid gap-4 sm:grid-cols-3"
                                data-home-reveal
                            >
                                {supportingNews.map((news, index) => (
                                    <Link
                                        key={news.id}
                                        href={`/news/${news.id}`}
                                        className="group relative min-h-56 overflow-hidden rounded-xl bg-secondary"
                                        data-home-reveal
                                        style={{
                                            animationDelay: `${index * 80}ms`,
                                        }}
                                    >
                                        <img
                                            src={news.image}
                                            alt=""
                                            loading="lazy"
                                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
                                        <div className="relative flex h-full min-h-56 flex-col justify-end gap-2 p-5 text-white">
                                            <span className="text-xs text-white/80">
                                                {news.category}
                                            </span>
                                            <h2 className="line-clamp-3 text-lg leading-snug font-semibold">
                                                {news.title}
                                            </h2>
                                            <span className="text-xs text-white/60">
                                                {news.date}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </section>
                        )}
                    </div>
                    <HomeShorts shorts={shorts} />
                    <section aria-label="Berita terbaru" className="relative">
                        <div className="sticky top-[65px] z-30 -mx-4 border-y border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                            <div
                                className="flex gap-2 overflow-x-auto pb-1"
                                aria-label="Filter kategori"
                            >
                                <Button
                                    variant={
                                        category === null
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className="shrink-0 rounded-full"
                                    aria-pressed={category === null}
                                    onClick={() => setCategory(null)}
                                >
                                    Latest
                                </Button>
                                {(categories as string[]).map((name) => (
                                    <Button
                                        key={name}
                                        variant={
                                            category === name
                                                ? 'default'
                                                : 'outline'
                                        }
                                        className="shrink-0 rounded-full"
                                        aria-pressed={category === name}
                                        onClick={() => setCategory(name)}
                                    >
                                        {name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div
                            className="divide-y divide-border"
                            aria-live="polite"
                            data-home-reveal
                        >
                            {filteredNews.map((news, index) => (
                                <article
                                    key={news.id}
                                    data-home-reveal
                                    style={{
                                        animationDelay: `${(index % 6) * 80}ms`,
                                    }}
                                >
                                    <Link
                                        href={`/news/${news.id}`}
                                        className="group flex items-center justify-between gap-4 py-6 sm:gap-8"
                                    >
                                        <div className="min-w-0 space-y-3">
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <Badge variant="secondary">
                                                    {news.category}
                                                </Badge>
                                                <span>{news.date}</span>
                                            </div>
                                            <h2 className="line-clamp-3 text-base leading-snug font-semibold transition-colors group-hover:text-primary sm:text-xl">
                                                {news.title}
                                            </h2>
                                            <p className="line-clamp-2 hidden text-sm text-muted-foreground sm:block">
                                                {news.preview}
                                            </p>
                                        </div>
                                        <img
                                            src={news.image}
                                            alt=""
                                            loading="lazy"
                                            className="h-24 w-28 shrink-0 rounded-lg object-cover sm:h-32 sm:w-48 lg:w-60"
                                        />
                                    </Link>
                                </article>
                            ))}
                            {!filteredNews.length && (
                                <p className="py-12 text-center text-muted-foreground">
                                    Belum ada berita lainnya
                                    {category
                                        ? ` dalam kategori ${category}`
                                        : ''}
                                    .
                                </p>
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
}
