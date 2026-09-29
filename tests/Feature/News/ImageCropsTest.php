<?php

use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use App\Services\FacebookPublishingService;
use App\Services\InstagramService;
use App\Services\News\MetaConnections;
use App\Services\NewsImageCropService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
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
