<?php

namespace Database\Seeders;

use App\Models\Comment;
use App\Models\Email;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

/** Synthetic presentation activity; never called by DatabaseSeeder. */
class NewsScenarioAnalyticsSeeder extends Seeder
{
    public const DOMAIN = 'news-scenario.example.test';

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Scenario data is restricted to local/testing.');
        }
        if (Email::where('email', 'like', '%@'.self::DOMAIN)->exists()) {
            $this->command?->info('Scenario dataset already exists; no records changed.');
            return;
        }
        $now = CarbonImmutable::now();
        $posts = News::active()->where('created_at', '<=', $now)->orderBy('postID')->get();
        if ($posts->isEmpty()) {
            throw new RuntimeException('Publish news before creating scenario activity.');
        }
        Model::withoutEvents(fn () => DB::transaction(function () use ($now, $posts) {
            $role = UserRole::firstOrCreate(['name' => 'villager']);
            $password = Hash::make(Str::random(64));
            $first = ['Adi', 'Dewi', 'Rizky', 'Siti', 'Budi', 'Rina', 'Agus', 'Fitri', 'Dimas', 'Wulan'];
            $last = ['Pratama', 'Lestari', 'Saputra', 'Wijaya', 'Permata', 'Santoso', 'Utami', 'Kurniawan'];
            $users = [];
            for ($i = 0; $i < 80; $i++) {
                $created = $now->subDays(2 + ($i * 7 % 85));
                $user = (new User)->forceFill([
                    'name' => $first[$i % 10].' '.$last[intdiv($i, 10)],
                    'password' => $password, 'roleID' => $role->getKey(),
                    'gender' => $i % 2 ? 'female' : 'male',
                    'date_of_birth' => $now->subYears(18 + ($i * 7 % 53))->subDays($i)->toDateString(),
                    'citizenship' => 'wni', 'ethnicity' => ['Jawa', 'Sunda', 'Melayu', 'Batak', null][$i % 5],
                    'created_at' => $created, 'updated_at' => $created,
                ]);
                $user->save();
                Email::create(['userID' => $user->getKey(), 'email' => 'resident'.($i + 1).'@'.self::DOMAIN, 'email_verified_at' => $created]);
                $users[] = $user;
                for ($day = 29; $day >= 0; $day--) {
                    foreach ([7, 12, 17, 19, 20] as $hour) {
                        $time = $now->timezone(config('analytics.timezone'))->subDays($day)->startOfDay()->addHours($hour)->utc();
                        if ($time->gt($now) || $time->lt($created) || ($i * 13 + $day * 7 + $hour) % 100 >= ($hour >= 19 ? 45 : 14)) continue;
                        DB::table('villager_activity_hours')->insertOrIgnore(['user_id' => $user->getKey(), 'hour' => $time, 'platform' => $i % 3 ? 'mobile' : 'web']);
                    }
                }
            }
            foreach ($posts as $index => $post) {
                $unique = [68, 54, 38, 29, 21, 61, 43][$index % 7];
                $likeCount = [19, 16, 18, 9, 5, 14, 11][$index % 7];
                $created = CarbonImmutable::parse($post->created_at);
                $span = max(0, $now->getTimestamp() - $created->getTimestamp());
                $addedViews = 0;
                foreach (array_slice($users, 0, $unique) as $i => $user) {
                    DB::table('news_viewers')->insertOrIgnore(['news_id' => $post->getKey(), 'viewer_key' => 'user:'.$user->getKey(), 'expires_at' => null]);
                    $visits = 1 + (($i + $index) % 4 === 0 ? 1 : 0);
                    $addedViews += $visits;
                    $time = $created->addSeconds((int) floor($span * ($i + 1) / ($unique + 1)));
                    if ($i < $likeCount) {
                        DB::table('likes')->insert(['postID' => $post->getKey(), 'userID' => $user->getKey(), 'created_at' => $time]);
                    }
                    if ($i < 4) {
                        (new Comment)->forceFill([
                            'newsID' => $post->getKey(), 'userID' => $user->getKey(),
                            'content' => $this->comments($post->title)[$i], 'status' => 'published',
                            'ai_flagged' => false, 'moderation_categories' => [],
                            'submission_hash' => hash('sha256', 'news-scenario:'.$post->getKey().':'.$i),
                            'created_at' => $time, 'updated_at' => $time,
                        ])->save();
                    }
                }
                // Lock and add to existing activity rather than replacing real counters.
                $locked = DB::table('news')->where('postID', $post->getKey())->lockForUpdate()->first();
                $viewers = DB::table('news_viewers')->where('news_id', $post->getKey())->count();
                DB::table('news')->where('postID', $post->getKey())->update([
                    'view' => max($viewers, $locked->view + $addedViews),
                    'unique_views' => max($viewers, $locked->unique_views + $unique),
                    'likes_count' => DB::table('likes')->where('postID', $post->getKey())->count(),
                ]);
            }
        }));
        $this->command?->info('Added 80 fictional residents and consistent news engagement. No external requests or messages sent.');
    }

    private function comments(string $title): array
    {
        $topics = [
            'Jalan' => ['Kalau berangkat kerja pukul tujuh, apakah motor masih bisa lewat?', 'Terima kasih sudah mencantumkan jalur alternatif.', 'Mohon akses ke rumah warga tetap diperhatikan.', 'Semoga cuacanya mendukung dan pekerjaan berjalan lancar.'],
            'Kesehatan' => ['Apakah lansia bisa mendaftar langsung di lokasi?', 'Saya akan mendampingi ibu untuk pemeriksaan.', 'Terima kasih, informasi dokumen yang perlu dibawa sangat membantu.', 'Apakah nomor antrean dibagikan sejak pukul delapan?'],
            'Kerja Bakti' => ['Saya bisa ikut setelah pukul delapan, boleh menyusul?', 'Saya akan membawa sapu dan sarung tangan.', 'Bagian dekat pos ronda juga perlu dibersihkan.', 'Semoga kegiatan seperti ini bisa rutin diadakan.'],
            'UMKM' => ['Apakah warga yang baru merintis usaha boleh ikut?', 'Saya ingin belajar memotret produk makanan.', 'Apakah ponsel biasa sudah cukup untuk praktik?', 'Materinya cocok untuk usaha rumahan seperti saya.'],
            'Baca' => ['Apakah buku cerita anak boleh dipinjam?', 'Jam sore lebih cocok untuk anak yang sekolah pagi.', 'Saya ingin menyumbangkan beberapa buku yang masih bagus.', 'Terima kasih kepada relawan yang mendampingi anak-anak.'],
            'Sampah' => ['Gang di belakang lapangan ikut jadwal wilayah mana?', 'Jadwalnya sudah saya catat supaya tidak terlambat.', 'Apakah titik pengumpulan masih di dekat pos ronda?', 'Semoga warga lebih tertib menyiapkan sampah sebelum petugas datang.'],
            'Musyawarah' => ['Mohon penerangan dekat lapangan ikut dibahas.', 'Saya akan menitipkan usulan melalui ketua RT.', 'Saluran air di ujung gang perlu diperiksa juga.', 'Semoga hasil pembahasan nanti bisa dibagikan kepada warga.'],
        ];
        foreach ($topics as $keyword => $comments) if (str_contains($title, $keyword)) return $comments;
        return ['Terima kasih atas informasinya.', 'Apakah ada informasi lanjutan mengenai kegiatan ini?', 'Saya akan membagikan informasi ini kepada keluarga.', 'Semoga kegiatan berjalan lancar.'];
    }
}
