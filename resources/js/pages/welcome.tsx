import { Head, Link, usePage } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { login, register } from '@/routes';
import type { SharedData } from '@/types';

const featuredNews = {
    title: 'Bali Perpanjang Siaga Bencana Cuaca Ekstrem 2026',
    date: '11 Februari 2025',
    category: 'Lingkungan',
    image: 'https://placehold.co/600x400',
    excerpt:
        'Denpasar, Bali – Pemerintah Provinsi Bali resmi memperpanjang status siaga bencana cuaca ekstrem hingga pertengahan tahun 2026 menyusul meningkatnya potensi hujan lebat, angin kencang, dan gelombang tinggi di sejumlah wilayah.',
};

const newsList = [
    {
        title: 'Desa Punggul Raih Penghargaan Desa Terbersih 2026',
        date: '11 Februari 2025',
        category: 'Lingkungan',
        image: 'https://placehold.co/400x300',
        excerpt:
            'Punggul – Desa Punggul berhasil meraih penghargaan sebagai Desa Terbersih 2026 tingkat kabupaten setelah melalui proses penilaian selama tiga bulan terakhir......',
    },
    {
        title: 'Banjir Rendam 3 Dusun di Desa Harapan Jaya, Warga Mengungsi',
        date: '11 Februari 2025',
        category: 'Lingkungan',
        image: 'https://placehold.co/400x300',
        excerpt:
            'Harapan Jaya – Hujan deras yang mengguyur wilayah Desa Harapan Jaya sejak Senin malam menyebabkan tiga dusun terendam......',
    },
    {
        title: 'UMKM Kerajinan Bambu Desa Mekar Sari Tembus Pasar Ekspor',
        date: '11 Februari 2025',
        category: 'Lingkungan',
        image: 'https://placehold.co/400x300',
        excerpt:
            'Mekar Sari – Produk kerajinan bambu hasil karya pelaku UMKM Desa Mekar Sari kini berhasil menembus pasar ekspor setelah mendapatkan......',
    },
];

export default function Welcome({
    canRegister = true,
}: {
    canRegister?: boolean;
}) {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title="ApaKhabar - Berita Terkini">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">

                {/* Navbar */}
                <nav className="border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 sticky top-0 z-40">
                    <div className="mx-auto flex max-w-7xl items-center justify-between">
                        <div className="flex items-center">
                            <Link href="/">
                                <img src="/logo_w_name.svg" alt="ApaKhabar" className="h-10 w-auto" />
                            </Link>
                        </div>
                        <div className="hidden items-center space-x-6 text-sm font-medium text-gray-700 dark:text-gray-300 md:flex">
                            <Link href="#" className="hover:text-green-600 dark:hover:text-green-400">Beranda</Link>
                            <Link href="#" className="hover:text-green-600 dark:hover:text-green-400">Lingkungan</Link>
                            <Link href="#" className="hover:text-green-600 dark:hover:text-green-400">Pengumuman</Link>
                            <Link href="#" className="hover:text-green-600 dark:hover:text-green-400">Kecemasan</Link>
                        </div>
                        <div className="flex items-center space-x-2">
                            {auth.user ? (
                                <>
                                    {(auth.user.role === 'admin' || auth.user.role === 'moderator') && (
                                        <Link
                                            href="/admin/dashboard"
                                            className="rounded-sm border border-gray-300 dark:border-neutral-700 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                                        >
                                            Dashboard
                                        </Link>
                                    )}
                                    <Link
                                        href="/logout"
                                        method="post"
                                        as="button"
                                        className="rounded-sm border border-gray-300 dark:border-neutral-700 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                                    >
                                        Keluar
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link
                                        href={login()}
                                        className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
                                    >
                                        Masuk
                                    </Link>
                                    {canRegister && (
                                        <Link
                                            href={register()}
                                            className="rounded-sm bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                                        >
                                            Daftar
                                        </Link>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </nav>

                {/* Breaking News Bar */}
                <div className="border-b border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 py-2 overflow-hidden">
                    <div
                        style={{
                            display: 'inline-flex',
                            whiteSpace: 'nowrap',
                            animation: 'marquee 18s linear infinite',
                        }}
                    >
                        <span className="inline-flex items-center gap-3 px-8">
                            <span className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-1 rounded inline-flex items-center gap-1 border border-red-300 dark:border-red-700">
                                <span className="h-2 w-2 rounded-full bg-red-500 inline-block animate-pulse"></span>
                                BREAKING
                            </span>
                            <span className="text-sm text-red-600 dark:text-red-400">
                                Banjir besar melanda Jakarta pagi ini, ribuan warga dievakuasi, pemerintah siaga darurat dan tim penyelamat dikerahkan ke lokasi.
                            </span>
                        </span>
                    </div>
                </div>

                <main className="mx-auto max-w-7xl px-20 md:px-28 pt-26 pb-8">

                    {/* Featured News */}
                    <div className="mb-8 flex flex-col md:flex-row items-stretch overflow-hidden rounded-md bg-white dark:bg-neutral-900">
                        <img
                            src={featuredNews.image}
                            alt={featuredNews.title}
                            className="w-full md:w-1/2 object-cover max-h-72 rounded-t-md md:rounded-t-none md:rounded-l-md"
                        />
                        <div className="w-full md:w-1/2 flex flex-col justify-start pt-4 pb-6 px-6">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-sm text-gray-500 dark:text-gray-400">{featuredNews.date}</span>
                                <Badge className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-100 text-sm">
                                    {featuredNews.category}
                                </Badge>
                            </div>
                            <h2 className="text-2xl font-bold mb-3 leading-snug text-gray-900 dark:text-white text-justify">
                                {featuredNews.title}
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed text-justify">
                                {featuredNews.excerpt}
                            </p>
                            <Link
                                href="/news/69c2b47fb592801f7a0a9b52"
                                className="text-sm font-medium text-gray-900 dark:text-white hover:underline mt-auto"
                            >
                                Baca Selengkapnya →
                            </Link>
                        </div>
                    </div>

                    {/* News Grid */}
                    {/* items-stretch makes all cards same height in each row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                        {newsList.map((news, index) => (
                            // h-full + flex flex-col makes card stretch to full row height
                            <div key={index} className="h-full flex flex-col overflow-hidden rounded-md bg-white dark:bg-neutral-900">
                                <img
                                    src={news.image}
                                    alt={news.title}
                                    className="w-full h-48 object-cover rounded-t-md flex-shrink-0"
                                />
                                {/* flex-1 so content area fills remaining height */}
                                <div className="flex flex-col flex-1 px-0 pt-3 pb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm text-gray-500 dark:text-gray-400">{news.date}</span>
                                        <Badge className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-100 text-sm">
                                            {news.category}
                                        </Badge>
                                    </div>
                                    <h3 className="text-lg font-bold mb-3 leading-snug text-gray-900 dark:text-white text-justify">
                                        {news.title}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed text-justify">
                                        {news.excerpt}
                                    </p>
                                    {/* mt-auto pushes link to bottom-left of every card */}
                                    <Link
                                        href="/news/69c2b47fb592801f7a0a9b52"
                                        className="text-sm font-medium text-gray-900 dark:text-white hover:underline mt-auto pt-4"
                                    >
                                        Baca Selengkapnya →
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>

                </main>
            </div>
        </>
    );
}