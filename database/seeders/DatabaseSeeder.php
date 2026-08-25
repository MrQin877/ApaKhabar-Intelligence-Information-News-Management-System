<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\UserRole;
use App\Models\BroadcastCategory;
use App\Models\Channel;
use App\Models\News;
use App\Models\NewsCategory;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        foreach (['admin', 'moderator', 'villager'] as $role) {
            UserRole::firstOrCreate(['name' => $role]);
        }

        foreach (['pengumuman', 'darurat'] as $category) {
            BroadcastCategory::firstOrCreate(['name' => $category]);
        }

        foreach (['whatsapp', 'sms', 'aplikasi'] as $channel) {
            Channel::firstOrCreate(['name' => $channel]);
        }

        User::factory()->create([
            'name' => 'Test User',
        ]);

        $articles = [
            [
                'title' => 'Pembangunan Jalan Desa Baru Permudah Akses Warga',
                'content' => 'Pemerintah Desa Sari Makmur resmi menyelesaikan pembangunan jalan desa yang menghubungkan area permukiman dengan lahan pertanian warga. Jalan baru ini diharapkan dapat mempermudah mobilitas masyarakat serta mempercepat distribusi hasil panen. Kepala desa menyampaikan bahwa proyek ini merupakan bagian dari program pembangunan desa tahun ini yang bertujuan meningkatkan kesejahteraan masyarakat.',
                'excerpt' => 'Pembangunan jalan desa baru membantu mempermudah akses warga menuju lahan pertanian dan pusat desa.',
                'category' => 'Pengumuman',
                'image' => 'https://images.unsplash.com/photo-1617719491063-fc9443eb8bd9?q=80&w=764&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
                'created_at' => '2026-03-15 00:00:00',
            ],
            [
                'title' => 'Siswa SD Desa Sari Makmur Tanam Pohon di Halaman Sekolah',
                'content' => 'Pada 18 Maret 2026, siswa SD Desa Sari Makmur melakukan kegiatan penanaman pohon di halaman sekolah. Kegiatan ini bertujuan menumbuhkan kesadaran lingkungan sejak dini dan mempercantik lingkungan sekolah. Guru dan orang tua turut mendampingi kegiatan agar berjalan aman dan tertib.',
                'excerpt' => 'Siswa SD Desa Sari Makmur menanam pohon untuk menumbuhkan kesadaran lingkungan sejak dini.',
                'category' => 'Lingkungan',
                'image' => 'https://images.unsplash.com/photo-1634151389979-2dea7604b36f?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
                'created_at' => '2026-03-18 00:00:00',
            ],
            [
                'title' => 'Pelatihan Komputer Gratis untuk Pemuda Desa',
                'content' => 'Karang Taruna Desa Sari Makmur bekerja sama dengan relawan pendidikan mengadakan pelatihan komputer gratis bagi pemuda desa. Pelatihan ini bertujuan meningkatkan keterampilan digital generasi muda agar mampu bersaing di era teknologi. Peserta diajarkan dasar-dasar penggunaan komputer, pengolahan dokumen, serta pengenalan internet secara aman.',
                'excerpt' => 'Pemuda desa mengikuti pelatihan komputer gratis untuk meningkatkan keterampilan digital.',
                'category' => 'Pendidikan',
                'image' => 'https://images.unsplash.com/photo-1569653402334-2e98fbaa80ee?q=80&w=1631&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
                'view' => 12,
                'created_at' => '2026-03-20 00:00:00',
            ],
            [
                'title' => 'Perpustakaan Mini Desa Sari Makmur Resmi Dibuka',
                'content' => 'Pada 13 Maret 2026, Desa Sari Makmur meresmikan perpustakaan mini yang dapat diakses oleh semua warga, khususnya anak-anak dan pelajar. Perpustakaan ini menyediakan buku pelajaran, buku cerita, dan materi literasi digital. Kepala desa berharap fasilitas ini dapat menumbuhkan minat baca dan mendukung pendidikan anak-anak desa.',
                'excerpt' => 'Perpustakaan mini Desa Sari Makmur dibuka untuk meningkatkan minat baca anak-anak dan pelajar.',
                'category' => 'Pendidikan',
                'image' => 'https://images.unsplash.com/photo-1646706751203-5b30c16bb137?q=80&w=736&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
                'created_at' => '2026-03-13 00:00:00',
            ],
            [
                'title' => 'Festival Panen Raya Desa Sari Makmur Meriahkan Akhir Pekan',
                'content' => 'Desa Sari Makmur menggelar Festival Panen Raya pada akhir pekan ini. Warga berkumpul untuk menikmati pertunjukan musik tradisional, lomba masak, dan pameran produk lokal. Kepala desa, Bapak Iwan, menyampaikan bahwa acara ini bertujuan mempererat kebersamaan masyarakat serta mempromosikan hasil pertanian desa. Festival akan berlangsung dari pagi hingga sore, dengan berbagai kegiatan menarik untuk anak-anak dan dewasa. Warga dan pengunjung diharapkan tetap mematuhi protokol kesehatan selama acara.',
                'excerpt' => 'Desa Sari Makmur menggelar Festival Panen Raya, merayakan kebersamaan dengan musik tradisional, lomba masak, dan pameran produk lokal.',
                'category' => 'Pengumuman',
                'image' => 'https://images.unsplash.com/photo-1719406567281-e929125f5cb4?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
                'created_at' => '2026-03-22 00:00:00',
            ],
        ];

        foreach ($articles as $article) {
            $categoryID = NewsCategory::firstOrCreate(['name' => $article['category']])->getKey();
            $createdAt = $article['created_at'];
            unset($article['category'], $article['created_at']);

            News::firstOrCreate(
                ['title' => $article['title']],
                [...$article, 'category_id' => $categoryID, 'created_at' => $createdAt, 'updated_at' => $createdAt],
            );
        }
    }
}
