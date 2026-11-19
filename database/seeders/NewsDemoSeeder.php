<?php

namespace Database\Seeders;

use App\Models\News;
use App\Models\NewsCategory;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/** Explicitly requested demonstration posts; no accounts, broadcasts or external publishing. */
class NewsDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')
            && (! $this->command || ! $this->command->confirm('Add or repair seeded news captions and category illustrations? Your accounts are unchanged.', false))) {
            throw new RuntimeException('Demo news creation cancelled.');
        }

        $admin = User::whereHas('roleRecord', fn ($query) => $query->where('name', 'admin'))->firstOrFail();
        $topics = [
            ['Desa', 'Perbaikan jalan lingkungan tahap kedua'],
            ['Kesehatan', 'Pemeriksaan kesehatan gratis di balai desa'],
            ['Kegiatan', 'Gotong royong membersihkan saluran air'],
            ['Bantuan Sosial', 'Pendaftaran bantuan kebutuhan pokok'],
            ['Pendidikan', 'Pelatihan komputer untuk pemuda'],
            ['Lingkungan', 'Penanaman pohon di lingkungan desa'],
            ['Kesehatan', 'Jadwal posyandu dan imunisasi anak'],
            ['Desa', 'Layanan administrasi akhir pekan'],
            ['Kegiatan', 'Pentas seni dan bazar warga'],
            ['Bantuan Sosial', 'Pembaruan daftar penerima bantuan'],
            ['Pendidikan', 'Perpustakaan desa membuka kelas membaca'],
            ['Lingkungan', 'Pemilahan sampah rumah tangga'],
            ['Desa', 'Musyawarah rencana pembangunan'],
            ['Kesehatan', 'Edukasi pencegahan demam berdarah'],
            ['Kegiatan', 'Lomba olahraga antarrukun warga'],
            ['Pendidikan', 'Pendampingan belajar siswa'],
        ];

        $created = Model::withoutEvents(fn () => DB::transaction(function () use ($admin, $topics): int {
            $count = 0;
            foreach ($topics as $index => [$categoryName, $title]) {
                $demoTitle = '[DEMO ANALITIK] '.$title;
                $existing = News::whereIn('title', [$title, $demoTitle])->first();
                // Repair only our untouched seeded content, never an admin-edited article.
                if ($existing && ! str_contains($existing->getRawOriginal('content') ?? '', 'DATA DEMO')
                    && ! str_starts_with($existing->getRawOriginal('image') ?? '', '/storage/news-images/seeded/')) {
                    continue;
                }
                $imagePath = 'news-images/seeded/news-'.($index + 1).'.svg';
                $colors = ['#0f766e', '#2563eb', '#b45309', '#7c3aed', '#0369a1', '#15803d'];
                $color = $colors[$index % count($colors)];
                $label = htmlspecialchars($categoryName, ENT_XML1 | ENT_QUOTES, 'UTF-8');
                $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">'
                    .'<rect width="1200" height="800" fill="'.$color.'"/>'
                    .'<circle cx="980" cy="160" r="95" fill="#ffffff" opacity=".18"/>'
                    .'<path d="M0 610L250 370L470 570L760 290L1200 660V800H0Z" fill="#ffffff" opacity=".12"/>'
                    .'<path d="M430 430L600 285L770 430V620H430Z" fill="#ffffff" opacity=".9"/>'
                    .'<rect x="565" y="475" width="70" height="145" rx="8" fill="'.$color.'"/>'
                    .'<text x="60" y="95" font-family="sans-serif" font-size="30" fill="#ffffff">ApaKhabar</text>'
                    .'<text x="60" y="735" font-family="sans-serif" font-size="48" font-weight="bold" fill="#ffffff">'.$label.'</text></svg>';
                if (! Storage::disk('public')->put($imagePath, $svg)) {
                    throw new RuntimeException('Could not save the seeded news illustration.');
                }
                $imageUrl = '/storage/'.$imagePath;
                $excerpt = $title.'. Informasi kegiatan dan layanan masyarakat desa.';
                $content = '<p>'.$title.'.</p><p>Halaman ini memuat informasi kegiatan dan layanan masyarakat desa. '
                    .'Rincian jadwal, lokasi, dan persyaratan dapat diperbarui oleh pengelola melalui ApaKhabar.</p>';
                if ($existing) {
                    $changes = ['title' => $title, 'image' => $imageUrl];
                    if (str_contains($existing->getRawOriginal('content') ?? '', 'DATA DEMO')) {
                        $changes['content'] = $content;
                    }
                    if (str_contains($existing->getRawOriginal('excerpt') ?? '', 'DATA DEMO')) {
                        $changes['excerpt'] = $excerpt;
                    }
                    $existing->forceFill($changes)->save();
                    $count++;
                    continue;
                }
                $category = NewsCategory::firstOrCreate(['name' => $categoryName]);
                $time = now()->subDays($index + 1);
                News::forceCreate([
                    'title' => $title,
                    'content' => $content,
                    'excerpt' => $excerpt,
                    'image' => $imageUrl,
                    'category_id' => $category->getKey(),
                    'created_by' => $admin->getKey(),
                    'creation_method' => 'manual',
                    'status' => 'active',
                    'show_on_homepage' => true,
                    'view' => 0,
                    'unique_views' => 0,
                    'likes_count' => 0,
                    'created_at' => $time,
                    'updated_at' => $time,
                ]);
                $count++;
            }

            return $count;
        }));

        $this->command?->info("Added or repaired {$created} seeded news posts. Accounts were not changed.");
    }
}
