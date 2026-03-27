import { Head, Link } from '@inertiajs/react';
import { HeaderBar } from '@/components/header-bar';
import { Badge } from '@/components/ui/badge';

// ─── Types ───────────────────────────────────────────────────────────────────

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
    // canRegister?: boolean;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Welcome({
    featuredNews,
    newsList = [],
    breakingNews,
    // canRegister = true,
}: Props) {
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

                {/* Breaking News Bar */}
                {breakingNews && (
                    <div className="border-b border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 py-2 overflow-hidden">
                        <div
                            style={{
                                display: 'inline-flex',
                                whiteSpace: 'nowrap',
                                animation: 'marquee 18s linear infinite',
                            }}
                        >
                            <span className="inline-flex items-center gap-3 px-8">
                                <span className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-sm font-bold px-2 py-1 rounded inline-flex items-center gap-1 border border-red-300 dark:border-red-700">
                                    <span className="h-2 w-2 rounded-full bg-red-500 inline-block animate-pulse"></span>
                                    BREAKING
                                </span>
                                <span className="text-base text-red-600 dark:text-red-400">
                                    {breakingNews}
                                </span>
                            </span>
                        </div>
                    </div>
                )}

                <main className="mx-auto max-w-7xl px-16 md:px-24 pt-26 pb-8">

                    {/* Featured News */}
                    {featuredNews ? (
                        <div className="mb-8 flex flex-col md:flex-row items-stretch overflow-hidden rounded-md bg-white dark:bg-neutral-900">
                            <img
                                src={featuredNews.image || 'https://placehold.co/600x400'}
                                alt={featuredNews.title}
                                className="w-full md:w-1/2 object-cover max-h-72 rounded-t-md md:rounded-t-none md:rounded-l-md"
                            />
                            <div className="w-full md:w-1/2 flex flex-col justify-start pt-4 pb-6 px-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{featuredNews.date}</span>
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
                                <Link
                                    href={`/news/${featuredNews.id}`}
                                    className="text-sm font-medium text-gray-900 dark:text-white hover:underline mt-auto"
                                >
                                    Baca Selengkapnya →
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-8 flex items-center justify-center h-48 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-400">
                            Belum ada berita utama.
                        </div>
                    )}

                    {/* News Grid */}
                    {newsList.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                            {newsList.map((news) => (
                                <div key={news.id} className="h-full flex flex-col overflow-hidden rounded-md bg-white dark:bg-neutral-900">
                                    <img
                                        src={news.image || 'https://placehold.co/400x300'}
                                        alt={news.title}
                                        className="w-full h-48 object-cover rounded-t-md flex-shrink-0"
                                    />
                                    <div className="flex flex-col flex-1 px-0 pt-3 pb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{news.date}</span>
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
                                        <Link
                                            href={`/news/${news.id}`}
                                            className="text-sm font-medium text-gray-900 dark:text-white hover:underline mt-auto pt-4"
                                        >
                                            Baca Selengkapnya →
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
                            <p className="text-sm">Belum ada berita tersedia.</p>
                        </div>
                    )}

                </main>
            </div>
        </>
    );
}