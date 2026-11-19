<?php

namespace Database\Seeders;

use App\Models\News;
use App\Models\NewsCategory;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OriginalNewsSeeder extends Seeder
{
    public function run(): void
    {
        $posts = json_decode(file_get_contents(__DIR__.'/data/original-news.json'), true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($posts) || count($posts) !== 5) {
            throw new RuntimeException('Expected the five original sample articles.');
        }
        foreach ($posts as $post) {
            foreach (['title', 'content', 'image', 'category', 'created_at'] as $key) {
                if (! is_string($post[$key] ?? null) || $post[$key] === '') {
                    throw new RuntimeException('Incomplete original news dataset.');
                }
            }
            if (parse_url($post['image'], PHP_URL_SCHEME) !== 'https'
                || parse_url($post['image'], PHP_URL_HOST) !== 'images.unsplash.com') {
                throw new RuntimeException('Unexpected image URL in original news dataset.');
            }
        }
        if (app()->environment('production') && (! $this->command
            || ! $this->command->confirm('Add the five original articles and hide the earlier generic seeded posts?', false))) {
            throw new RuntimeException('Original news import cancelled.');
        }
        $admin = User::whereHas('roleRecord', fn ($query) => $query->where('name', 'admin'))->firstOrFail();
        $created = Model::withoutEvents(fn () => DB::transaction(function () use ($posts, $admin): int {
            $created = 0;
            foreach ($posts as $post) {
                if (News::where('title', $post['title'])->exists()) {
                    continue;
                }
                $category = NewsCategory::firstOrCreate(['name' => $post['category']]);
                News::forceCreate([
                    'title' => $post['title'],
                    'content' => $post['content'],
                    'excerpt' => $post['excerpt'],
                    'image' => $post['image'],
                    'category_id' => $category->getKey(),
                    'created_by' => $admin->getKey(),
                    'creation_method' => 'manual',
                    'status' => 'active',
                    'show_on_homepage' => true,
                    'view' => 0,
                    'unique_views' => 0,
                    'likes_count' => 0,
                    'created_at' => $post['created_at'],
                    'updated_at' => $post['created_at'],
                ]);
                $created++;
            }
            $genericTitles = [
                'Perbaikan jalan lingkungan tahap kedua', 'Pemeriksaan kesehatan gratis di balai desa',
                'Gotong royong membersihkan saluran air', 'Pendaftaran bantuan kebutuhan pokok',
                'Pelatihan komputer untuk pemuda', 'Penanaman pohon di lingkungan desa',
                'Jadwal posyandu dan imunisasi anak', 'Layanan administrasi akhir pekan',
                'Pentas seni dan bazar warga', 'Pembaruan daftar penerima bantuan',
                'Perpustakaan desa membuka kelas membaca', 'Pemilahan sampah rumah tangga',
                'Musyawarah rencana pembangunan', 'Edukasi pencegahan demam berdarah',
                'Lomba olahraga antarrukun warga', 'Pendampingan belajar siswa',
            ];
            $candidates = array_merge($genericTitles, array_map(fn ($title) => '[DEMO ANALITIK] '.$title, $genericTitles));
            foreach (News::whereIn('title', $candidates)->get() as $generic) {
                $plainTitle = preg_replace('/^\[DEMO ANALITIK\] /', '', $generic->title);
                $oldContent = '<p>DATA DEMO — dibuat untuk demonstrasi ApaKhabar, bukan informasi atau pengumuman resmi.</p>'
                    .'<p>'.$plainTitle.'. Contoh kegiatan komunitas untuk presentasi platform ApaKhabar.</p>';
                $revisedContent = '<p>'.$plainTitle.'.</p><p>Halaman ini memuat informasi kegiatan dan layanan masyarakat desa. '
                    .'Rincian jadwal, lokasi, dan persyaratan dapat diperbarui oleh pengelola melalui ApaKhabar.</p>';
                // Only hide exact generated article bodies, preserving edited articles and engagement.
                if (in_array($generic->getRawOriginal('content'), [$oldContent, $revisedContent], true)) {
                    $generic->forceFill(['status' => 'archived', 'show_on_homepage' => false])->save();
                }
            }

            return $created;
        }));
        $this->command?->info("Imported {$created} original articles. Earlier unchanged generic posts were archived. Accounts were not changed.");
    }
}
