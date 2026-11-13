<?php

use App\Services\WebsiteTranslation;
use Illuminate\Contracts\Console\Kernel;

// Run inside the application container; uses real LibreTranslate, never Http::fake.
require '/var/www/html/vendor/autoload.php';
require '/tmp/WebsiteTranslation.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $e) {
    fwrite(STDERR, $e::class.': '.$e->getMessage().PHP_EOL);
    exit(1);
});
$fixtures = [
    'id' => ['Sekolah baru dibuka', 'Pemerintah meningkatkan pendidikan masyarakat.', 'Para siswa belajar di sekolah baru. Guru menyediakan buku dan membantu anak membaca. Warga menyambut program pendidikan yang diumumkan pemerintah.'],
    'en' => ['New school opens', 'The government is improving public education.', 'Students study at the new school. Teachers provide books and help children read. Residents welcomed the education programme announced by the government.'],
];
$translator = app(WebsiteTranslation::class);
foreach ($fixtures as $source => [$title, $description, $paragraph]) {
    $paragraph .= $source === 'id' ? ' Perpustakaan juga menyediakan bahan bacaan untuk keluarga.' : ' The library also provides reading materials for families.';
    foreach (array_diff(['id', 'en'], [$source]) as $target) {
        $start = microtime(true);
        // Unique numbered paragraphs make omissions visible without logging real news.
        $texts = [$title, $description];
        for ($i = 1; $i <= 48; $i++) {
            $texts[] = "$paragraph ($i)";
        }
        $translated = [];
        foreach (array_chunk($texts, 4) as $batch) {
            array_push($translated, ...$translator->translate($batch, $target, $source));
        }
        if (count($translated) !== count($texts) || array_filter($translated, fn ($text) => ! is_string($text) || ! trim($text))) {
            throw new RuntimeException('Incomplete result');
        }
        for ($i = 1; $i <= 48; $i++) {
            if (! str_contains($translated[$i + 1], (string) $i)) {
                throw new RuntimeException("Missing paragraph $i");
            }
        }
        $cacheStart = microtime(true);
        foreach (array_chunk($texts, 4) as $batch) {
            $translator->translate($batch, $target, $source);
        }
        echo json_encode(['pair' => "$source->$target", 'source_characters' => mb_strlen(implode("\n\n", $texts)), 'fields_and_paragraphs' => count($translated), 'seconds' => round(microtime(true) - $start, 2), 'cached_seconds' => round(microtime(true) - $cacheStart, 3), 'title' => $translated[0], 'description' => $translated[1], 'first_paragraph' => $translated[2], 'last_paragraph' => end($translated)], JSON_UNESCAPED_UNICODE)."\n";
    }
}
