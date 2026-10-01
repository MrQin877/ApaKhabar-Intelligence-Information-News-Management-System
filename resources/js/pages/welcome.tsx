import { Head, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { HeaderBar } from '@/components/header-bar';
import { Badge } from '@/components/ui/badge';

interface NewsItem {
    id: string;
    title: string;
    date: string;
    category: string;
    image: string;
    preview: string;
}

interface Props {
    featuredNews: NewsItem | null;
    newsList: NewsItem[];
    breakingNews: string | null;
    breakingMessage: string | null;
    breakingSentAt: string | null;
}

export default function Welcome({
    featuredNews,
    newsList = [],
    breakingNews,
    breakingMessage,
    breakingSentAt,
}: Props) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60000);

        return () => window.clearInterval(timer);
    }, []);

    const timeRemaining = breakingSentAt
        ? Math.max(
              0,
              24 -
                  Math.floor(
                      (now - new Date(breakingSentAt).getTime()) / 3600000,
                  ),
          )
        : 0;

    return (
        <>
            <Head title="ApaKhabar - Berita Terkini">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen bg-background text-foreground">
                <HeaderBar />

                {/* ── Darurat Broadcast Bar — shows 24 hours only ── */}
                {breakingNews && timeRemaining > 0 && (
                    <div className="overflow-hidden border-b border-danger-border/50 bg-danger-bg py-2">
                        <div
                            style={{
                                display: 'inline-flex',
                                whiteSpace: 'nowrap',
                                animation: 'marquee 18s linear infinite',
                            }}
                        >
                            <span className="inline-flex items-center gap-3 px-8">
                                {/* Darurat badge */}
                                <span className="inline-flex shrink-0 items-center gap-1 rounded border border-danger-border bg-danger-text/10 px-2 py-1 text-sm font-bold text-danger-text">
                                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-danger-500" />
                                    DARURAT
                                </span>

                                {/* Title */}
                                <span className="text-base font-semibold text-danger-text">
                                    {breakingNews}
                                </span>

                                {/* Message */}
                                {breakingMessage && (
                                    <>
                                        <span className="text-danger-text">
                                            —
                                        </span>
                                        <span className="text-sm text-danger-text">
                                            {breakingMessage}
                                        </span>
                                    </>
                                )}
                            </span>
                        </div>
                    </div>
                )}

                <main className="mx-auto max-w-7xl px-16 pt-26 pb-8 md:px-24">
                    {/* ── Featured News ── */}
                    {featuredNews ? (
                        // Fade-slide-up on mount
                        <div className="mb-8 flex animate-fade-slide-up flex-col items-stretch overflow-hidden rounded-md bg-card transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg md:flex-row">
                            {/* Image zoom on hover — wrap with overflow-hidden + group */}
                            <div className="group w-full overflow-hidden rounded-t-md md:w-1/2 md:rounded-t-none md:rounded-l-md">
                                <img
                                    src={
                                        featuredNews.image ||
                                        'https://placehold.co/600x400'
                                    }
                                    alt={featuredNews.title}
                                    className="h-full max-h-72 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                            </div>
                            <div className="flex w-full flex-col justify-start px-6 pt-4 pb-6 md:w-1/2">
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        {featuredNews.date}
                                    </span>
                                    <Badge className="bg-brand-100 text-xs text-brand-800 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-300">
                                        {featuredNews.category}
                                    </Badge>
                                </div>
                                <h2 className="mb-3 text-justify text-xl leading-snug font-bold text-card-foreground">
                                    {featuredNews.title}
                                </h2>
                                <p className="mb-4 text-justify text-sm leading-relaxed text-muted-foreground">
                                    {featuredNews.preview}
                                </p>
                                {/* Underline draw on hover */}
                                <Link
                                    href={`/news/${featuredNews.id}`}
                                    className="relative mt-auto w-fit text-sm font-medium text-card-foreground after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-current after:transition-[width] after:duration-300 hover:after:w-full"
                                >
                                    Baca Selengkapnya →
                                </Link>
                            </div>
                        </div>
                    ) : (
                        /* Skeleton for featured */
                        <div className="mb-8 flex flex-col overflow-hidden rounded-md md:flex-row">
                            <div className="animate-shimmer h-72 w-full rounded-t-md md:w-1/2 md:rounded-t-none md:rounded-l-md" />
                            <div className="flex w-full flex-col gap-3 p-6 md:w-1/2">
                                <div className="animate-shimmer h-3 w-24 rounded" />
                                <div className="animate-shimmer h-5 w-full rounded" />
                                <div className="animate-shimmer h-5 w-3/4 rounded" />
                                <div className="animate-shimmer mt-2 h-3 w-full rounded" />
                                <div className="animate-shimmer h-3 w-5/6 rounded" />
                            </div>
                        </div>
                    )}

                    {/* ── News Grid ── */}
                    {newsList.length > 0 ? (
                        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
                            {newsList.map((news, index) => (
                                // Staggered fade-slide-up per card
                                <div
                                    key={news.id}
                                    className="flex h-full animate-fade-slide-up flex-col overflow-hidden rounded-md bg-card transition-transform duration-300 hover:-translate-y-1 hover:shadow-md"
                                    style={{
                                        animationDelay: `${index * 100}ms`,
                                    }}
                                >
                                    {/* Image zoom — same group trick */}
                                    <div className="group flex-shrink-0 overflow-hidden rounded-t-md">
                                        <img
                                            src={
                                                news.image ||
                                                'https://placehold.co/400x300'
                                            }
                                            alt={news.title}
                                            className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    </div>
                                    <div className="flex flex-1 flex-col px-0 pt-3 pb-4">
                                        <div className="mb-2 flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                {news.date}
                                            </span>
                                            <Badge className="bg-brand-100 text-xs text-brand-800 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-300">
                                                {news.category}
                                            </Badge>
                                        </div>
                                        <h3 className="mb-3 text-justify text-lg leading-snug font-bold text-card-foreground">
                                            {news.title}
                                        </h3>
                                        <p className="text-justify text-sm leading-relaxed text-muted-foreground">
                                            {news.preview}
                                        </p>
                                        {/* Underline draw on hover */}
                                        <Link
                                            href={`/news/${news.id}`}
                                            className="relative mt-auto w-fit pt-4 text-sm font-medium text-card-foreground after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-current after:transition-[width] after:duration-300 hover:after:w-full"
                                        >
                                            Baca Selengkapnya →
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Skeleton grid when no news yet */
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            {[...Array(3)].map((_, i) => (
                                <div
                                    key={i}
                                    className="flex flex-col gap-3 overflow-hidden rounded-md"
                                >
                                    <div className="animate-shimmer h-48 w-full rounded-t-md" />
                                    <div className="animate-shimmer h-3 w-20 rounded" />
                                    <div className="animate-shimmer h-4 w-full rounded" />
                                    <div className="animate-shimmer h-4 w-4/5 rounded" />
                                    <div className="animate-shimmer h-3 w-full rounded" />
                                    <div className="animate-shimmer h-3 w-3/4 rounded" />
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
