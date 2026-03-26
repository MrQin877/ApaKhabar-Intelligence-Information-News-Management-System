import { Head, Link } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { HeaderBar } from '@/components/header-bar';

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

                    {/* Page Title */}
                    <div className="mb-8">
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
                        <div className="text-center py-24 text-gray-400 dark:text-gray-600">
                            <p className="text-sm">Belum ada berita dalam kategori ini.</p>
                            <Link href="/" className="text-sm text-green-600 hover:underline mt-2 inline-block">
                                Kembali ke Beranda
                            </Link>
                        </div>
                    )}

                </main>
            </div>
        </>
    );
}