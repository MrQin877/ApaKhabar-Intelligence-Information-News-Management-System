import { Head, Link, usePage } from '@inertiajs/react';
import { login, register } from '@/routes';
import type { SharedData } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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

            <div className="min-h-screen bg-white">

                {/* ✅ Standalone Navbar — safe for public/unauthenticated users */}
                <nav className="border-b border-gray-200 bg-white px-4 py-3">
                    <div className="mx-auto flex max-w-7xl items-center justify-between">

                        {/* Logo */}
                        <div className="flex items-center">
                            <img
                                src="/logo_w_name.svg"
                                alt="ApaKhabar"
                                className="h-10 w-auto"
                            />
                        </div>

                        {/* Nav Links */}
                        <div className="hidden items-center space-x-6 text-sm font-medium text-gray-700 md:flex">
                            <Link href="#" className="hover:text-green-600">Beranda</Link>
                            <Link href="#" className="hover:text-green-600">Lingkungan</Link>
                            <Link href="#" className="hover:text-green-600">Pengumuman</Link>
                            <Link href="#" className="hover:text-green-600">Kecemasan</Link>
                        </div>

                        {/* Auth Buttons */}
                        <div className="flex items-center space-x-2">
                            {auth.user ? (
                                <>
                                    {(auth.user.role === 'admin' || auth.user.role === 'moderator') && (
                                        <Link
                                            href="/admin/dashboard"
                                            className="rounded-sm border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-100"
                                        >
                                            Dashboard
                                        </Link>
                                    )}
                                    <Link
                                        href="/logout"
                                        method="post"
                                        as="button"
                                        className="rounded-sm border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-100"
                                    >
                                        Log out
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link
                                        href={login()}
                                        className="text-sm font-medium text-gray-700 hover:text-black"
                                    >
                                        Log in
                                    </Link>
                                    {canRegister && (
                                        <Link
                                            href={register()}
                                            className="rounded-sm bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                                        >
                                            Register
                                        </Link>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </nav>

                {/* Breaking News Bar */}
                <div className="border-b bg-red-50 py-2 overflow-hidden">
                    <div
                        style={{
                            display: 'inline-flex',
                            whiteSpace: 'nowrap',
                            animation: 'marquee 18s linear infinite',
                        }}
                    >
                        <span className="inline-flex items-center gap-3 px-8">
                            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded inline-flex items-center gap-1 border border-red-300">
                                <span className="h-2 w-2 rounded-full bg-red-500 inline-block animate-pulse"></span>
                                BREAKING
                            </span>
                            <span className="text-sm text-red-600">
                                Banjir besar melanda Jakarta pagi ini, ribuan warga dievakuasi, pemerintah siaga darurat dan tim penyelamat dikerahkan ke lokasi.
                            </span>
                        </span>
                    </div>
                </div>        

                <main className="mx-auto max-w-7xl px-4 py-8">

                    {/* Featured News */}
                    <Card className="mb-8 flex flex-col md:flex-row overflow-hidden shadow-sm">
                        <img
                            src={featuredNews.image}
                            alt={featuredNews.title}
                            className="w-full md:w-1/2 object-cover max-h-72"
                        />
                        <CardContent className="p-6 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-sm text-gray-500">{featuredNews.date}</span>
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                    {featuredNews.category}
                                </Badge>
                            </div>
                            <h2 className="text-2xl font-bold mb-3 leading-snug">
                                {featuredNews.title}
                            </h2>
                            <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                                {featuredNews.excerpt}
                            </p>
                            <Link href="#" className="text-sm font-medium hover:underline">
                                Baca Selengkapnya →
                            </Link>
                        </CardContent>
                    </Card>

                    {/* News Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {newsList.map((news, index) => (
                            <Card key={index} className="overflow-hidden shadow-sm">
                                <img
                                    src={news.image}
                                    alt={news.title}
                                    className="w-full h-48 object-cover"
                                />
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-gray-500">{news.date}</span>
                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                                            {news.category}
                                        </Badge>
                                    </div>
                                    <h3 className="font-bold text-sm mb-2 leading-snug">
                                        {news.title}
                                    </h3>
                                    <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                                        {news.excerpt}
                                    </p>
                                    <Link href="#" className="text-xs font-medium hover:underline">
                                        Baca Selengkapnya →
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                </main>
            </div>
        </>
    );
}