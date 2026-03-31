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
    newsList: NewsItem[];
    activeCategory: string;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NewsCategory({ newsList = [], activeCategory }: Props) {
    return (
        <>
            <Head title={`${activeCategory} — ApaKhabar`}>
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen bg-white dark:bg-neutral-900">

                <HeaderBar />

                <main className="mx-auto max-w-7xl px-16 md:px-24 pt-10 pb-8">

                    {/* Page Title — fade-slide-up on mount */}
                    <div className="animate-fade-slide-up mb-8">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {activeCategory}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {newsList.length} berita ditemukan
                        </p>
                    </div>

                    {/* News Grid */}
                    {newsList.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                            {newsList.map((news, index) => (
                                // Staggered fade-up + hover lift
                                <div
                                    key={news.id}
                                    className="animate-fade-slide-up h-full flex flex-col overflow-hidden rounded-md bg-white dark:bg-neutral-900
                                               transition-transform duration-300 hover:-translate-y-1 hover:shadow-md"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    {/* Image zoom on hover */}
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
                        // Skeleton grid for empty state
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