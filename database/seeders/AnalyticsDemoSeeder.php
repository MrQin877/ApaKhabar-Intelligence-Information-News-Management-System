<?php

namespace Database\Seeders;

use App\Models\Broadcast;
use App\Models\BroadcastCategory;
use App\Models\Channel;
use App\Models\Comment;
use App\Models\Email;
use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\NewsCategory;
use App\Models\User;
use App\Models\UserRole;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

/** Explicitly opt-in local presentation data. Never called by DatabaseSeeder. */
class AnalyticsDemoSeeder extends Seeder
{
    public const PREFIX = '[DEMO ANALITIK] ';

    public const EMAIL_DOMAIN = 'analytics-demo.example.test';

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Data demo hanya boleh dibuat di lingkungan local/testing.');
        }
        if (Email::where('email', 'warga001@'.self::EMAIL_DOMAIN)->exists()) {
            $this->command?->info('Dataset demo sudah ada; tidak ada data yang diubah atau digandakan.');

            return;
        }
        $admin = User::whereHas('roleRecord', fn ($q) => $q->where('name', 'admin'))->firstOrFail();
        $moderator = User::whereHas('roleRecord', fn ($q) => $q->where('name', 'moderator'))->first() ?? $admin;
        $zone = config('analytics.timezone');
        $now = CarbonImmutable::now($zone);
        $anchor = $now->startOfDay();
        $record = fn (CarbonImmutable $time) => $time->timezone(config('app.timezone'));

        Model::withoutEvents(fn () => DB::transaction(function () use ($admin, $moderator, $now, $anchor, $record) {
            $role = UserRole::firstOrCreate(['name' => 'villager']);
            $password = Hash::make(Str::random(64)); // No shared/login-ready demo password.
            $users = [];
            $ageBuckets = [16, 22, 29, 29, 29, 40, 40, 50, 60, 72, null];
            $ethnicities = ['Jawa', 'Jawa', 'Jawa', 'Sunda', 'Sunda', 'Batak', 'Minang', 'Melayu', 'Lainnya', null];
            for ($i = 1; $i <= 144; $i++) {
                $offset = $i <= 84 ? 1 + ($i * 7 % 29) : ($i <= 126 ? 30 + ($i * 11 % 30) : 60 + ($i * 13 % 30));
                $created = $record($anchor->subDays($offset)->addHours(7 + $i % 10));
                $age = $ageBuckets[$i % count($ageBuckets)];
                $user = (new User)->forceFill([
                    'name' => '[Demo] Warga '.str_pad((string) $i, 3, '0', STR_PAD_LEFT), 'password' => $password, 'roleID' => $role->getKey(),
                    'date_of_birth' => $age !== null ? $anchor->subYears($age)->subDays($i % 180)->toDateString() : null,
                    'citizenship' => $i % 20 === 0 ? null : ($i % 20 === 1 ? 'wna' : ($i % 20 === 2 ? 'dual' : 'wni')),
                    'gender' => $i % 17 === 0 ? null : ($i % 2 ? 'male' : 'female'), 'ethnicity' => $ethnicities[$i % 10],
                    'created_at' => $created, 'updated_at' => $created,
                ]);
                $user->save();
                Email::create(['email' => 'warga'.str_pad((string) $i, 3, '0', STR_PAD_LEFT).'@'.self::EMAIL_DOMAIN, 'userID' => $user->getKey(), 'email_verified_at' => $created]);
                $users[] = $user;
            }

            // Hour buckets are UTC. Peaks are synthetic observations, not recommendations.
            $activity = [];
            for ($day = 29; $day >= 0; $day--) {
                $date = $anchor->subDays($day);
                foreach ([7, 9, 12, 14, 17, 19, 20, 21] as $hour) {
                    $local = $date->addHours($hour);
                    if ($local->gt($now)) {
                        continue;
                    }
                    $peak = in_array($date->dayOfWeekIso, [3, 4], true) && in_array($hour, [19, 20], true);
                    foreach ($users as $i => $user) {
                        if ($user->created_at->gt($record($local))) {
                            continue;
                        }
                        if (($i * 17 + $day * 7 + $hour * 3) % 100 >= ($peak ? 64 : ($hour >= 19 ? 28 : 9))) {
                            continue;
                        }
                        $activity[] = ['user_id' => $user->getKey(), 'hour' => $local->utc()->format('Y-m-d H:i:s'), 'platform' => $i % 3 === 0 ? 'web' : 'mobile'];
                    }
                }
            }
            foreach (array_chunk($activity, 500) as $chunk) {
                DB::table('villager_activity_hours')->insert($chunk);
            }

            $topics = [
                ['Desa', 'Perbaikan jalan lingkungan tahap kedua'], ['Kesehatan', 'Pemeriksaan kesehatan gratis di balai desa'],
                ['Kegiatan', 'Gotong royong membersihkan saluran air'], ['Bantuan Sosial', 'Pendaftaran bantuan kebutuhan pokok'],
                ['Pendidikan', 'Pelatihan komputer untuk pemuda'], ['Lingkungan', 'Penanaman pohon di lingkungan desa'],
                ['Kesehatan', 'Jadwal posyandu dan imunisasi anak'], ['Desa', 'Layanan administrasi akhir pekan'],
                ['Kegiatan', 'Pentas seni dan bazar warga'], ['Bantuan Sosial', 'Pembaruan daftar penerima bantuan'],
                ['Pendidikan', 'Perpustakaan desa membuka kelas membaca'], ['Lingkungan', 'Pemilahan sampah rumah tangga'],
                ['Desa', 'Musyawarah rencana pembangunan'], ['Kesehatan', 'Edukasi pencegahan demam berdarah'],
                ['Kegiatan', 'Lomba olahraga antarrukun warga'], ['Pendidikan', 'Pendampingan belajar siswa'],
            ];
            foreach ($topics as $p => [$categoryName, $title]) {
                $category = NewsCategory::firstOrCreate(['name' => $categoryName]);
                $created = $record($anchor->subDays(1 + $p * 2)->addHours(8 + $p % 5));
                $unique = 45 + ($p * 19 % 100);
                $post = (new News)->forceFill(['title' => self::PREFIX.$title, 'content' => '<p>DATA DEMO — dibuat khusus untuk demonstrasi analitik, bukan informasi atau pengumuman resmi.</p><p>'.$title.'. Contoh kegiatan komunitas untuk presentasi platform ApaKhabar.</p>', 'excerpt' => 'DATA DEMO untuk presentasi analitik.', 'category_id' => $category->getKey(), 'created_by' => $admin->getKey(), 'creation_method' => $p % 2 ? 'manual' : 'ai', 'status' => $p >= 14 ? 'archived' : 'active', 'view' => $unique * (2 + $p % 4), 'unique_views' => $unique, 'likes_count' => 0, 'show_on_homepage' => false, 'created_at' => $created, 'updated_at' => $created]);
                $post->save();
                $viewers = [];
                foreach (array_slice($users, 0, $unique) as $user) {
                    $viewers[] = ['news_id' => $post->getKey(), 'viewer_key' => 'user:'.$user->getKey(), 'expires_at' => null];
                }
                DB::table('news_viewers')->insert($viewers);
                $likes = 12 + ($p * 13 % 55);
                foreach (array_slice($users, 0, $likes) as $i => $user) {
                    $time = $created->addDays($i % max(1, (int) $created->diffInDays($now)))->addHours(1);
                    $time = $time->max(CarbonImmutable::parse($user->created_at)->addHour())->min($record($now->subMinutes(20)));
                    DB::table('likes')->insert(['postID' => $post->getKey(), 'userID' => $user->getKey(), 'created_at' => $time]);
                }
                $post->forceFill(['likes_count' => $likes])->save();
                for ($j = 0; $j < 10 + $p % 12; $j++) {
                    $user = $users[($p * 7 + $j) % count($users)];
                    $status = $j % 10 < 7 ? 'published' : ($j % 10 < 9 ? 'pending_review' : 'rejected');
                    $time = $created->addDays($j % max(1, (int) $created->diffInDays($now)))->max(CarbonImmutable::parse($user->created_at)->addHour())->min($record($now->subHours(2)));
                    $comment = (new Comment)->forceFill(['newsID' => $post->getKey(), 'userID' => $j % 8 === 0 ? null : $user->getKey(), 'guest_name' => $j % 8 === 0 ? '[Demo] Tamu' : null, 'content' => self::PREFIX.['Terima kasih, informasinya membantu warga.', 'Apakah jadwal layanan ini juga tersedia hari Sabtu?', 'Mohon informasi lokasi kegiatan selengkapnya.', 'Saya ingin memberikan saran untuk kegiatan berikutnya.'][$j % 4].' (contoh '.($p + 1).'-'.($j + 1).')', 'status' => $status, 'ai_flagged' => $status !== 'published', 'moderation_reason' => 'Data demo, bukan hasil penilaian AI.', 'moderation_categories' => [], 'submission_hash' => hash('sha256', 'analytics-demo-v1:'.$p.':'.$j), 'created_at' => $time, 'updated_at' => $time]);
                    if ($status !== 'pending_review') {
                        $decision = $time->addMinutes(15)->max($record($anchor->subDays($j % 7)->addHours(8)))->min($record($now->subMinutes(10)));
                        $comment->forceFill(['moderator_id' => $moderator->getKey(), 'moderated_at' => $decision]);
                    }
                    $comment->save();
                    if ($status !== 'pending_review') {
                        DB::table('comment_moderation_history')->insert(['comment_id' => $comment->getKey(), 'moderator_id' => $moderator->getKey(), 'from_status' => 'pending_review', 'to_status' => $status, 'reason' => ($status === 'published' ? 'approve: ' : 'reject: ').self::PREFIX.'Contoh keputusan untuk demonstrasi.', 'created_at' => $decision]);
                    }
                    if ($status === 'pending_review' && $j % 2) {
                        DB::table('comment_reports')->insert(['comment_id' => $comment->getKey(), 'user_id' => $users[($p + 90) % 144]->getKey(), 'reason' => self::PREFIX.'Contoh laporan untuk antrean peninjauan.', 'created_at' => $time->addMinutes(5)]);
                    }
                }
            }

            for ($i = 0; $i < 9; $i++) {
                $category = BroadcastCategory::firstOrCreate(['name' => ['darurat', 'pengumuman', 'informasi'][$i % 3]]);
                $sent = $record($anchor->subDays(1 + $i * 2)->addHours(9));
                $broadcast = (new Broadcast)->forceFill(['title' => self::PREFIX.['Simulasi kesiapsiagaan warga', 'Jadwal layanan dan kegiatan desa', 'Informasi fasilitas komunitas'][$i % 3].' #'.($i + 1), 'message' => 'DATA DEMO ANALITIK — ini contoh rekaman siaran, bukan pesan yang dikirim ke warga.', 'created_by' => $admin->getKey(), 'categoryID' => $category->getKey(), 'status' => 'terkirim', 'send_mode' => 'now', 'sent_at' => $sent, 'created_at' => $sent, 'updated_at' => $sent]);
                $broadcast->save();
                $broadcast->channels()->attach(Channel::firstOrCreate(['name' => 'aplikasi'])->getKey());
                $recipients = array_values(array_filter($users, fn ($user) => $user->created_at->lte($sent)));
                $recipients = array_slice($recipients, 0, 65 + $i * 7);
                foreach ($recipients as $u => $user) {
                    $read = ($u * 37 + $i * 11) % 100 < [88, 64, 47][$i % 3];
                    DB::table('broadcast_user')->insert(['broadcast_id' => $broadcast->getKey(), 'user_id' => $user->getKey()]);
                    DB::table('notifications')->insert(['type' => 'analytics_demo', 'data' => json_encode(['broadcast_id' => (string) $broadcast->getKey(), 'title' => $broadcast->title, 'message' => $broadcast->message, 'type' => $category->name, 'channel' => 'aplikasi', 'demo' => true]), 'notifiable_id' => $user->getKey(), 'notifiable_type' => User::class, 'alertID' => $broadcast->getKey(), 'read_at' => $read ? $sent->addMinutes(5 + $u % 120) : null, 'created_at' => $sent, 'updated_at' => $sent]);
                }
            }
            foreach (['Rencana kegiatan bulan depan', 'Panduan layanan warga', 'Laporan kegiatan lingkungan'] as $i => $title) {
                (new IntelligentNewsDraft)->forceFill(['created_by' => $admin->getKey(), 'title' => self::PREFIX.$title, 'content' => 'DATA DEMO — contoh draf untuk demonstrasi dashboard.', 'excerpt' => 'Draf demo untuk presentasi.', 'labels' => ['demo-analitik'], 'sources_used' => [], 'warnings' => ['DATA DEMO, bukan berita resmi.'], 'creation_method' => $i % 2 ? 'ai' : 'manual', 'status' => 'draft', 'created_at' => $record($anchor->subDays($i + 1)), 'updated_at' => $record($now)])->save();
            }
        }));
        $this->command?->info('Data demo analitik berhasil dibuat. Tidak ada pesan, email, pekerjaan antrean, atau panggilan API yang dikirim.');
    }
}
