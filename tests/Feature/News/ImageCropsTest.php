<?php

use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\NewsCategory;
use App\Models\User;
use App\Models\UserRole;
use App\Services\FacebookPublishingService;
use App\Services\InstagramService;
use App\Services\News\MetaConnections;
use App\Services\NewsImageCropService;
use App\Services\PublicationPreviewFiles;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

function cropSettings(): array
{
    return ['sync' => false, 'website' => ['x' => 0, 'y' => 0.5, 'zoom' => 4],
        'instagram' => ['x' => 1, 'y' => 0.5, 'zoom' => 4], 'facebook' => ['x' => 0.5, 'y' => 0.5, 'zoom' => 1]];
}

function cropUpload(): UploadedFile
{
    $image = imagecreatetruecolor(400, 200);
    imagefilledrectangle($image, 0, 0, 199, 199, imagecolorallocate($image, 255, 0, 0));
    imagefilledrectangle($image, 200, 0, 399, 199, imagecolorallocate($image, 0, 0, 255));
    ob_start();
    imagepng($image);
    $bytes = ob_get_clean();
    imagedestroy($image);

    return UploadedFile::fake()->createWithContent('original.png', $bytes);
}

function cropArticle(): array
{
    return ['headline' => 'Pratinjau berita warga', 'content' => '<p>Berita kegiatan warga yang berlangsung hari ini.</p>',
        'content_format' => 'html', 'intent' => 'draft', 'cover_photo' => cropUpload(), 'image_crops' => cropSettings()];
}

beforeEach(function () {
    Storage::fake('public');
    config(['filesystems.news_media_disk' => 'public']);
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
});

test('crop settings survive draft reload and variants preserve original bytes with independent framing', function () {
    $article = cropArticle();
    $original = file_get_contents($article['cover_photo']->getRealPath());
    $this->post('/admin/news/manual', $article)->assertSessionHasNoErrors()->assertRedirect();
    $draft = IntelligentNewsDraft::sole();
    expect($draft->image_crops)->toBe(cropSettings());
    expect(Storage::disk('public')->get('news-images/'.basename($draft->image)))->toBe($original);
    foreach (NewsImageCropService::SIZES as $platform => [$width, $height]) {
        $bytes = Storage::disk('public')->get('news-images/crops/'.basename($draft->image_variants[$platform]));
        $info = getimagesizefromstring($bytes);
        expect([$info[0], $info[1], $info[2]])->toBe([$width, $height, IMAGETYPE_JPEG]);
        $image = imagecreatefromstring($bytes);
        $color = imagecolorsforindex($image, imagecolorat($image, 10, 10));
        if ($platform === 'website') {
            expect($color['red'])->toBeGreaterThan(240);
        }
        if ($platform === 'instagram') {
            expect($color['blue'])->toBeGreaterThan(240);
        }
        imagedestroy($image);
    }
    $this->get('/admin/news/manual/'.$draft->id.'/edit')->assertInertia(fn (Assert $page) => $page->where('draft.image_crops', cropSettings()));
});

test('publishing routes separate cropped images while retaining the original draft image', function () {
    $this->mock(MetaConnections::class)->shouldReceive('platforms')->andReturn(array_map(fn ($id) => ['id' => $id, 'name' => $id, 'status' => 'connected'], ['website', 'facebook', 'instagram']));
    $facebook = $this->mock(FacebookPublishingService::class);
    $facebook->shouldReceive('configured')->andReturn(true);
    $facebook->shouldReceive('publish')->once()->withArgs(function ($url) {
        return $url === IntelligentNewsDraft::sole()->image_variants['facebook'];
    })->andReturn('123_456');
    $this->mock(InstagramService::class)->shouldReceive('publish')->once()->withArgs(function ($url, $caption, $context, $cropped) {
        return $cropped && $url === IntelligentNewsDraft::sole()->image_variants['instagram'];
    })->andReturn('789');
    $this->postJson('/admin/news/manual', [...cropArticle(), 'intent' => 'publish', 'platforms' => ['website', 'facebook', 'instagram'], 'image_crops' => json_encode(cropSettings())])
        ->assertOk()->assertJsonPath('success', true);
    $draft = IntelligentNewsDraft::sole();
    expect(News::sole()->image)->toBe($draft->image_variants['website'])->not->toBe($draft->image);
});

test('invalid and incomplete crops are rejected before storing images', function () {
    $settings = cropSettings();
    $settings['instagram']['zoom'] = 20;
    $this->post('/admin/news/manual', [...cropArticle(), 'image_crops' => $settings])->assertSessionHasErrors('image_crops.instagram.zoom');
    unset($settings['instagram']);
    $this->post('/admin/news/manual', [...cropArticle(), 'image_crops' => $settings])->assertSessionHasErrors('image_crops.instagram');
    expect(IntelligentNewsDraft::count())->toBe(0);
    expect(Storage::disk('public')->allFiles())->toBe([]);
});

test('publication preview and final publication use the identical generated crop variants', function () {
    $preview = $this->postJson('/admin/news/manual/preview', cropArticle())->assertOk()->json();
    foreach (NewsImageCropService::SIZES as $platform => [$width, $height]) {
        $bytes = Storage::disk('public')->get(preg_replace('~^/storage/~', '', parse_url($preview['images'][$platform], PHP_URL_PATH)));
        $size = getimagesizefromstring($bytes);
        expect([$size[0], $size[1]])->toBe([$width, $height]);
    }
    $this->postJson('/admin/news/manual', [
        'intent' => 'publish', 'platforms' => ['website'], 'preview_token' => $preview['token'],
    ])->assertOk()->assertJsonPath('success', true);
    expect(News::sole()->image)->toBe($preview['images']['website'])
        ->and(IntelligentNewsDraft::sole()->image_variants)->toEqual($preview['images']);
});

test('social-only preview sends exactly the reviewed captions and platform images', function () {
    $preview = $this->postJson('/admin/news/manual/preview', cropArticle())->assertOk()->json();
    $this->mock(MetaConnections::class)->shouldReceive('platforms')->andReturn(array_map(
        fn ($id) => ['id' => $id, 'name' => $id, 'status' => 'connected'], ['website', 'facebook', 'instagram']
    ));
    $facebook = $this->mock(FacebookPublishingService::class);
    $facebook->shouldReceive('configured')->andReturn(true);
    $facebook->shouldReceive('publish')->once()->withArgs(fn ($url, $caption) => $url === $preview['images']['facebook'] && $caption === $preview['caption']
    )->andReturn('123_456');
    $this->mock(InstagramService::class)->shouldReceive('publish')->once()->withArgs(fn ($url, $caption, $context, $cropped) => $cropped && $url === $preview['images']['instagram'] && $caption === $preview['caption']
    )->andReturn('789');
    $this->postJson('/admin/news/manual', [
        'intent' => 'publish', 'platforms' => ['facebook', 'instagram'], 'preview_token' => $preview['token'],
    ])->assertOk()->assertJsonPath('success', true);
    expect(News::count())->toBe(0);
});

test('uploaded preview snapshots work with file cache for every platform selection', function (array $platforms, bool $stored) {
    $cachePath = storage_path('framework/testing/preview-cache-'.Str::uuid());
    config(['cache.default' => 'preview_regression', 'cache.stores.preview_regression' => ['driver' => 'file', 'path' => $cachePath]]);
    Http::preventStrayRequests();
    try {
        $article = cropArticle();
        $category = NewsCategory::create(['name' => 'Lingkungan', 'slug' => 'lingkungan-preview', 'status' => 'active']);
        $article['category_id'] = $category->getKey();
        $existing = null;
        if ($stored) {
            $this->post('/admin/news/manual', $article)->assertSessionHasNoErrors();
            $existing = IntelligentNewsDraft::sole();
            unset($article['cover_photo']);
            $article['image'] = $existing->image;
        }
        $preview = $this->postJson('/admin/news/manual/preview', [...$article, 'platforms' => $platforms])->assertOk()->json();
        $snapshot = Cache::get('publication-preview:'.$preview['token']);
        $assertSerializable = function ($value) use (&$assertSerializable): void {
            if (is_array($value)) {
                foreach ($value as $child) {
                    $assertSerializable($child);
                }
            } else {
                expect(is_null($value) || is_scalar($value))->toBeTrue();
            }
        };
        $assertSerializable($snapshot);
        expect($snapshot['data'])->not->toHaveKey('cover_photo');
        expect($snapshot['data']['headline'])->toBe($article['headline'])
            ->and($snapshot['data']['content'])->toBe($article['content'])
            ->and($snapshot['data']['category_id'])->toBe($category->getKey());
        expect($snapshot['data']['image_crops'])->toBe(cropSettings())
            ->and(IntelligentNewsDraft::count())->toBe($stored ? 1 : 0)
            ->and(News::count())->toBe(0);
        Http::assertNothingSent();
        foreach ($preview['images'] as $platform => $url) {
            $path = preg_replace('~^/storage/~', '', parse_url($url, PHP_URL_PATH));
            $size = getimagesizefromstring(Storage::disk('public')->get($path));
            expect([$size[0], $size[1]])->toBe(NewsImageCropService::SIZES[$platform]);
        }
        $this->mock(MetaConnections::class)->shouldReceive('platforms')->andReturn(array_map(
            fn ($id) => ['id' => $id, 'name' => $id, 'status' => 'connected'], ['website', 'facebook', 'instagram']
        ));
        $facebook = $this->mock(FacebookPublishingService::class);
        $facebook->shouldReceive('configured')->andReturn(true);
        if (in_array('facebook', $platforms)) {
            $facebook->shouldReceive('publish')->once()->withArgs(fn ($url, $caption) => $url === $preview['images']['facebook'] && $caption === $preview['caption'])->andReturn('123_456');
        } else {
            $facebook->shouldNotReceive('publish');
        }
        $instagram = $this->mock(InstagramService::class);
        if (in_array('instagram', $platforms)) {
            $instagram->shouldReceive('publish')->once()->withArgs(fn ($url, $caption, $context, $cropped) => $cropped && $url === $preview['images']['instagram'] && $caption === $preview['caption'])->andReturn('789');
        } else {
            $instagram->shouldNotReceive('publish');
        }
        $payload = ['intent' => 'publish', 'platforms' => $platforms, 'preview_token' => $preview['token']];
        ($existing ? $this->putJson('/admin/news/manual/'.$existing->id, $payload) : $this->postJson('/admin/news/manual', $payload))
            ->assertOk()->assertJsonPath('success', true);
        expect(IntelligentNewsDraft::sole()->image_variants)->toEqual($preview['images']);
        $this->travel(3)->hours();
        app(PublicationPreviewFiles::class)->cleanup();
        foreach ($preview['images'] as $url) {
            Storage::disk('public')->assertExists(preg_replace('~^/storage/~', '', parse_url($url, PHP_URL_PATH)));
        }
    } finally {
        app('files')->deleteDirectory($cachePath);
    }
})->with([
    'aplikasi' => [['website']], 'facebook' => [['facebook']], 'instagram' => [['instagram']],
    'aplikasi facebook' => [['website', 'facebook']], 'aplikasi instagram' => [['website', 'instagram']],
    'facebook instagram' => [['facebook', 'instagram']], 'all' => [['website', 'facebook', 'instagram']],
])->with(['new upload' => false, 'stored image' => true]);

test('abandoned previews expire and cleanup preserves stored originals and active previews', function () {
    $this->post('/admin/news/manual', cropArticle())->assertSessionHasNoErrors();
    $draft = IntelligentNewsDraft::sole();
    $article = cropArticle();
    unset($article['cover_photo']);
    $article['image'] = $draft->image;
    $old = $this->postJson('/admin/news/manual/preview', $article)->assertOk()->json();
    $this->travel(3)->hours();
    $active = $this->postJson('/admin/news/manual/preview', cropArticle())->assertOk()->json();
    $this->artisan('news:cleanup-publication-previews')->assertSuccessful();
    foreach ($old['images'] as $url) {
        Storage::disk('public')->assertMissing(preg_replace('~^/storage/~', '', parse_url($url, PHP_URL_PATH)));
    }
    foreach ([$draft->image, ...array_values($draft->image_variants), ...array_values($active['images'])] as $url) {
        Storage::disk('public')->assertExists(preg_replace('~^/storage/~', '', parse_url($url, PHP_URL_PATH)));
    }
});

test('preview processing failures are reported with a safe message', function () {
    Exceptions::fake();
    $this->mock(NewsImageCropService::class)->shouldReceive('generate')->once()->andThrow(new RuntimeException('preview processing failed'));
    $this->postJson('/admin/news/manual/preview', cropArticle())->assertStatus(500)
        ->assertExactJson(['message' => 'Pratinjau belum dapat disiapkan. Silakan coba lagi.']);
    Exceptions::assertReported(RuntimeException::class);
    $this->travel(3)->hours();
    $this->artisan('news:cleanup-publication-previews')->assertSuccessful();
    expect(Storage::disk('public')->allFiles('news-images/previews'))->toBe([]);
});
