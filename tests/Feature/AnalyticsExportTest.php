<?php

use App\Models\AnalyticsSetting;
use App\Models\Broadcast;
use App\Models\Comment;
use App\Models\Like;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Analytics\AnalyticsExport;
use App\Services\Analytics\AnalyticsReport;
use App\Services\Analytics\PostPerformance;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpSpreadsheet\IOFactory;

function reportAdmin(): User
{
    return User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
}
function reportSheets(?int $post = null): array
{
    return app(AnalyticsExport::class)->data(app(AnalyticsReport::class)->build(array_keys(AnalyticsReport::WIDGETS), '2026-10-19', '2026-10-19'), '2026-10-19', '2026-10-19', 'all', $post);
}

test('period interactions use reporting timezone without changing cumulative views', function () {
    config(['app.timezone' => 'UTC', 'analytics.timezone' => 'Asia/Jakarta']);
    $news = News::create(['title' => 'Boundary news', 'content' => 'Test', 'view' => 31]);
    $news->forceFill(['unique_views' => 8])->save();
    foreach (['2026-10-18 16:59:59', '2026-10-18 17:00:00', '2026-10-19 16:59:59', '2026-10-19 17:00:00'] as $time) {
        $user = User::factory()->create();
        Like::create(['postID' => $news->getKey(), 'userID' => $user->getKey()])->forceFill(['created_at' => $time])->save();
        Comment::create(['newsID' => $news->getKey(), 'userID' => $user->getKey(), 'content' => 'Test', 'status' => 'published'])->forceFill(['created_at' => $time])->save();
    }
    Comment::create(['newsID' => $news->getKey(), 'content' => 'Pending', 'status' => 'pending_review'])->forceFill(['created_at' => '2026-10-19 05:00:00'])->save();
    $row = app(PostPerformance::class)->selected($news->getKey(), '2026-10-19', '2026-10-19');
    expect($row)->toMatchArray(['views' => 31, 'unique' => 8, 'likes' => 2, 'comments' => 2, 'ratio' => null]);
    expect(app(PostPerformance::class)->interactionTrend('2026-10-19', '2026-10-19', $news->getKey()))->toBe([['label' => '2026-10-19', 'likes' => 2, 'comments' => 2]]);
});

test('exports include all results and broadcasts beyond table limits and retain honest unavailable states', function () {
    $admin = reportAdmin();
    for ($i = 0; $i < 17; $i++) {
        News::create(['title' => 'Report news '.$i, 'content' => 'Test', 'view' => $i]);
    }
    for ($i = 0; $i < 32; $i++) {
        Broadcast::create(['created_by' => $admin->getKey(), 'title' => 'Report broadcast '.$i, 'message' => 'Test', 'sent_at' => '2026-10-19 09:00:00']);
    }
    Http::preventStrayRequests();
    $sheets = reportSheets();
    expect($sheets['Berita']['rows'])->toHaveCount(68);
    expect($sheets['Siaran']['rows'])->toHaveCount(3 + 32 * 3);
    expect($sheets['Website']['rows'][0][4])->toBe('Belum tersedia');
    expect($sheets['Facebook']['rows'][0][4])->toBe('Belum tersedia');
    expect($sheets['Berita']['rows'][0][4])->toBe(16);
    expect($sheets['Berita']['rows'][2][4])->toBe(0);
    $response = $this->actingAs($admin)->get('/admin/analytics?from=2026-10-19&to=2026-10-19&export=csv&scope=posts');
    $response->assertDownload();
    $csv = $response->streamedContent();
    expect($csv)->toContain('Report news 16', 'Report news 0', 'Satuan', 'Cakupan data')->not->toContain('Report broadcast');
});

test('selected post exports ignore listing search pagination and hidden widget choices', function () {
    $admin = reportAdmin();
    $post = News::create(['title' => 'Selected news', 'content' => 'Test', 'view' => 8]);
    News::create(['title' => 'Other news', 'content' => 'Test', 'view' => 99]);
    AnalyticsSetting::current()->update(['layout' => ['version' => 2, 'sections' => []], 'widgets' => []]);
    $url = '/admin/analytics?from=2026-10-19&to=2026-10-19&search=not-matching&posts_page=9&post='.$post->getKey();
    $this->actingAs($admin)->get($url.'&section=posts')->assertInertia(fn (Assert $page) => $page
        ->where('selectedPost.id', $post->getKey())->where('selectedPost.views', 8)->where('activeTab', 'posts')->has('posts.data', 0));
    $response = $this->get($url.'&export=csv&scope=all&export_post='.$post->getKey())->assertOk();
    expect($response->streamedContent())->toContain('Selected news', 'Total tayangan kumulatif')->not->toContain('Other news', 'Seluruh website');
});

test('xlsx is a real workbook with categorized sheets native charts axis units and literal untrusted values', function () {
    $admin = reportAdmin();
    User::factory()->create(['ethnicity' => '=1+1']);
    News::create(['title' => 'Excel news', 'content' => 'Test', 'view' => 12]);
    Http::preventStrayRequests();
    $response = $this->actingAs($admin)->get('/admin/analytics?from=2026-10-19&to=2026-10-19&export=xlsx')->assertOk()->assertDownload();
    $path = $response->baseResponse->getFile()->getPathname();
    try {
        $zip = new ZipArchive;
        expect($zip->open($path))->toBeTrue();
        $xml = $zip->getFromName('xl/charts/chart1.xml');
        expect($xml)->toContain('Tanggal', 'Interaksi (jumlah)', 'Suka aktif');
        $zip->close();
        $reader = IOFactory::createReader('Xlsx');
        $reader->setIncludeCharts(true);
        $book = $reader->load($path);
        expect($book->getSheetNames())->toBe(['Ringkasan', 'Pengguna', 'Berita', 'Siaran', 'Website', 'Aktivitas', 'Facebook', 'Instagram', 'Definisi']);
        expect($book->getSheetByName('Ringkasan')->getChartCount())->toBe(1);
        expect($book->getSheetByName('Berita')->getCell('E24')->getValue())->toBe(12);
        $ethnicCell = null;
        foreach ($book->getSheetByName('Pengguna')->getCellCollection()->getCoordinates() as $coordinate) {
            $cell = $book->getSheetByName('Pengguna')->getCell($coordinate);
            if ($cell->getValue() === '=1+1') {
                $ethnicCell = $cell;
            }
        }
        expect($ethnicCell)->not->toBeNull();
        expect($ethnicCell->getDataType())->toBe('s');
        $book->disconnectWorksheets();
    } finally {
        unlink($path);
    }
});

test('csv preserves columns and neutralizes formulas while keeping numeric zero', function () {
    $entry = ['Engagement', 'Website', ' +malicious', '=1+1', 0, 'kali', 'Kumulatif', '2026-10-19', '2026-10-19', 'Explanation', 'Tersedia'];
    $stream = fopen('php://temp', 'w+');
    app(AnalyticsExport::class)->csv(['Berita' => ['rows' => [$entry]]], $stream);
    rewind($stream);
    $header = fgetcsv($stream);
    $row = fgetcsv($stream);
    fclose($stream);
    expect($header)->toHaveCount(11);
    expect($row)->toHaveCount(11);
    expect($row[2])->toBe("' +malicious");
    expect($row[3])->toBe("'=1+1");
    expect($row[4])->toBe('0');
});

test('both export formats remain admin only and invalid scopes are rejected', function () {
    $moderator = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'moderator'])->getKey()]);
    foreach (['csv', 'xlsx'] as $format) {
        $this->actingAs($moderator)->get('/admin/analytics?export='.$format)->assertForbidden();
    }
    $this->actingAs(reportAdmin())->getJson('/admin/analytics?export=xlsx&scope=unknown')->assertUnprocessable()->assertJsonValidationErrors('scope');
});
