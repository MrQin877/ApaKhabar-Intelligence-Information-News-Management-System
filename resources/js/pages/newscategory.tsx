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
    preview: string;
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

            <div className="min-h-screen bg-background text-foreground">
                <HeaderBar />

                <main className="mx-auto max-w-7xl px-16 pt-10 pb-8 md:px-24">
                    {/* Page Title — fade-slide-up on mount */}
                    <div className="mb-8 animate-fade-slide-up">
                        <h1 className="text-2xl font-bold text-foreground">
                            {activeCategory}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {newsList.length} berita ditemukan
                        </p>
                    </div>

                    {/* News Grid */}
                    {newsList.length > 0 ? (
                        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
                            {newsList.map((news, index) => (
                                // Staggered fade-up + hover lift
                                <div
                                    key={news.id}
                                    className="flex h-full animate-fade-slide-up flex-col overflow-hidden rounded-md bg-card transition-transform duration-300 hover:-translate-y-1 hover:shadow-md"
                                    style={{
                                        animationDelay: `${index * 100}ms`,
                                    }}
                                >
                                    {/* Image zoom on hover */}
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
                        // Skeleton grid for empty state
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
