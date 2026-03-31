import { Head, Link } from '@inertiajs/react';
import { HeaderBar } from '@/components/header-bar';
import { Badge } from '@/components/ui/badge';

interface NewsItem {
    id: string;
    title: string;
    date: string;
    category: string;
    image: string;
    excerpt: string;
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
    const timeRemaining = breakingSentAt
    ? Math.max(0, 24 - Math.floor((Date.now() - new Date(breakingSentAt).getTime()) / 3600000))
    : 0
    return (
        <>
            <Head title="ApaKhabar - Berita Terkini">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen bg-white dark:bg-neutral-900">

                <HeaderBar />

                {/* ── Darurat Broadcast Bar — shows 24 hours only ── */}
                {breakingNews && timeRemaining > 0 && (
                    <div className="border-b border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 py-2 overflow-hidden">
                        <div
                            style={{
                                display: 'inline-flex',
                                whiteSpace: 'nowrap',
                                animation: 'marquee 18s linear infinite',
                            }}
                        >
                            <span className="inline-flex items-center gap-3 px-8">
                                {/* Darurat badge */}
                                <span className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-sm font-bold px-2 py-1 rounded inline-flex items-center gap-1 border border-red-300 dark:border-red-700 shrink-0">
                                    <span className="h-2 w-2 rounded-full bg-red-500 inline-block animate-pulse" />
                                    DARURAT
                                </span>

                                {/* Title */}
                                <span className="text-base font-semibold text-red-700 dark:text-red-400">
                                    {breakingNews}
                                </span>

                                {/* Message */}
                                {breakingMessage && (
                                    <>
                                        <span className="text-red-400 dark:text-red-600">—</span>
                                        <span className="text-sm text-red-600 dark:text-red-400">
                                            {breakingMessage}
                                        </span>
                                    </>
                                )}

                            </span>
                        </div>
                    </div>
                )}

                <main className="mx-auto max-w-7xl px-16 md:px-24 pt-26 pb-8">

                    {/* ── Featured News ── */}
                    {featuredNews ? (
                        // Fade-slide-up on mount
                        <div className="animate-fade-slide-up mb-8 flex flex-col md:flex-row items-stretch overflow-hidden rounded-md bg-white dark:bg-neutral-900
                                        transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
                            {/* Image zoom on hover — wrap with overflow-hidden + group */}
                            <div className="group w-full md:w-1/2 overflow-hidden rounded-t-md md:rounded-t-none md:rounded-l-md">
                                <img
                                    src={featuredNews.image || 'https://placehold.co/600x400'}
                                    alt={featuredNews.title}
                                    className="w-full object-cover max-h-72 h-full
                                               transition-transform duration-500 group-hover:scale-105"
                                />
                            </div>
                            <div className="w-full md:w-1/2 flex flex-col justify-start pt-4 pb-6 px-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {featuredNews.date}
                                    </span>
                                    <Badge className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-100 text-xs">
                                        {featuredNews.category}
                                    </Badge>
                                </div>
                                <h2 className="text-xl font-bold mb-3 leading-snug text-gray-900 dark:text-white text-justify">
                                    {featuredNews.title}
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed text-justify">
                                    {featuredNews.excerpt}
                                </p>
                                {/* Underline draw on hover */}
                                <Link
                                    href={`/news/${featuredNews.id}`}
                                    className="text-sm font-medium text-gray-900 dark:text-white mt-auto
                                               relative w-fit after:absolute after:bottom-0 after:left-0
                                               after:h-px after:w-0 after:bg-current
                                               after:transition-[width] after:duration-300
                                               hover:after:w-full"
                                >
                                    Baca Selengkapnya →
                                </Link>
                            </div>
                        </div>
                    ) : (
                        /* Skeleton for featured */
                        <div className="mb-8 flex flex-col md:flex-row overflow-hidden rounded-md">
                            <div className="w-full md:w-1/2 h-72 animate-shimmer rounded-t-md md:rounded-t-none md:rounded-l-md" />
                            <div className="w-full md:w-1/2 flex flex-col gap-3 p-6">
                                <div className="h-3 w-24 animate-shimmer rounded" />
                                <div className="h-5 w-full animate-shimmer rounded" />
                                <div className="h-5 w-3/4 animate-shimmer rounded" />
                                <div className="h-3 w-full animate-shimmer rounded mt-2" />
                                <div className="h-3 w-5/6 animate-shimmer rounded" />
                            </div>
                        </div>
                    )}

                    {/* ── News Grid ── */}
                    {newsList.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                            {newsList.map((news, index) => (
                                // Staggered fade-slide-up per card
                                <div
                                    key={news.id}
                                    className="animate-fade-slide-up h-full flex flex-col overflow-hidden rounded-md bg-white dark:bg-neutral-900
                                               transition-transform duration-300 hover:-translate-y-1 hover:shadow-md"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    {/* Image zoom — same group trick */}
                                    <div className="group overflow-hidden rounded-t-md flex-shrink-0">
                                        <img
                                            src={news.image || 'https://placehold.co/400x300'}
                                            alt={news.title}
                                            className="w-full h-48 object-cover
                                                       transition-transform duration-500 group-hover:scale-105"
                                        />
                                    </div>
                                    <div className="flex flex-col flex-1 px-0 pt-3 pb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {news.date}
                                            </span>
                                            <Badge className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-100 text-xs">
                                                {news.category}
                                            </Badge>
                                        </div>
                                        <h3 className="text-lg font-bold mb-3 leading-snug text-gray-900 dark:text-white text-justify">
                                            {news.title}
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed text-justify">
                                            {news.excerpt}
                                        </p>
                                        {/* Underline draw on hover */}
                                        <Link
                                            href={`/news/${news.id}`}
                                            className="text-sm font-medium text-gray-900 dark:text-white mt-auto pt-4
                                                       relative w-fit after:absolute after:bottom-0 after:left-0
                                                       after:h-px after:w-0 after:bg-current
                                                       after:transition-[width] after:duration-300
                                                       hover:after:w-full"
                                        >
                                            Baca Selengkapnya →
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Skeleton grid when no news yet */
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex flex-col gap-3 overflow-hidden rounded-md">
                                    <div className="h-48 w-full animate-shimmer rounded-t-md" />
                                    <div className="h-3 w-20 animate-shimmer rounded" />
                                    <div className="h-4 w-full animate-shimmer rounded" />
                                    <div className="h-4 w-4/5 animate-shimmer rounded" />
                                    <div className="h-3 w-full animate-shimmer rounded" />
                                    <div className="h-3 w-3/4 animate-shimmer rounded" />
                                </div>
                            ))}
                        </div>
                    )}

                </main>
            </div>
        </>
    );
}