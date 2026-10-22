<?php

use App\Models\IntelligenceDocument;
use App\Models\IntelligentNewsDraft;
use App\Models\User;
use App\Models\UserRole;
use App\Services\NewsImageCropService;
use App\Services\NewsImageOptimizer;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    Storage::fake('public');
    config(['filesystems.news_media_disk' => 'public']);
    Http::preventStrayRequests();
});

test('large uploads become proportionate WebP files with stable deduplicated paths', function (string $extension) {
    $upload = UploadedFile::fake()->image('large.'.$extension, 2400, 1200);
    $service = app(NewsImageOptimizer::class);
    $path = $service->store($upload);
    expect($service->store($upload))->toBe($path);
    $info = getimagesizefromstring(Storage::disk('public')->get($path));
    expect(array_slice($info, 0, 3))->toBe([1920, 960, IMAGETYPE_WEBP])
        ->and(Storage::disk('public')->allFiles())->toHaveCount(1)
        ->and($path)->toEndWith('.webp');
    Http::assertNothingSent();
})->with(['jpg', 'png']);

test('small transparent images retain size and alpha including palette PNG', function (bool $palette) {
    $image = $palette ? imagecreate(40, 20) : imagecreatetruecolor(40, 20);
    if ($palette) {
        $transparent = imagecolorallocate($image, 0, 0, 0);
        imagecolortransparent($image, $transparent);
    } else {
        imagealphablending($image, false);
        imagesavealpha($image, true);
        $transparent = imagecolorallocatealpha($image, 0, 0, 0, 127);
    }
    imagefill($image, 0, 0, $transparent);
    imagefilledrectangle($image, 20, 0, 39, 19, imagecolorallocate($image, 255, 0, 0));
    ob_start();
    imagepng($image);
    $bytes = ob_get_clean();
    imagedestroy($image);
    $webp = app(NewsImageOptimizer::class)->convert($bytes);
    $decoded = imagecreatefromstring($webp);
    expect([imagesx($decoded), imagesy($decoded)])->toBe([40, 20])
        ->and(imagecolorsforindex($decoded, imagecolorat($decoded, 5, 5))['alpha'])->toBe(127)
        ->and(imagecolorsforindex($decoded, imagecolorat($decoded, 30, 5))['alpha'])->toBe(0);
    imagedestroy($decoded);
})->with([false, true]);

test('all EXIF orientations are baked into pixels before resizing', function (int $orientation, array $expected) {
    $image = imagecreatetruecolor(80, 40);
    $colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
    foreach ($colors as $i => $color) {
        $x = ($i % 2) * 40;
        $y = intdiv($i, 2) * 20;
        imagefilledrectangle($image, $x, $y, $x + 39, $y + 19, imagecolorallocate($image, ...$color));
    }
    ob_start();
    imagejpeg($image, null, 100);
    $jpeg = ob_get_clean();
    imagedestroy($image);
    $exif = "Exif\0\0II".pack('vV', 42, 8).pack('v', 1).pack('vvVv', 0x112, 3, 1, $orientation)."\0\0".pack('V', 0);
    $jpeg = substr($jpeg, 0, 2)."\xff\xe1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2);
    $decoded = imagecreatefromstring(app(NewsImageOptimizer::class)->convert($jpeg));
    $w = imagesx($decoded);
    $h = imagesy($decoded);
    expect([$w, $h])->toBe($orientation >= 5 ? [40, 80] : [80, 40]);
    foreach ($expected as $i => $colorIndex) {
        $pixel = imagecolorsforindex($decoded, imagecolorat($decoded, (int) ($w * (($i % 2) ? 0.75 : 0.25)), (int) ($h * ($i >= 2 ? 0.75 : 0.25))));
        foreach (['red', 'green', 'blue'] as $channel => $name) {
            expect(abs($pixel[$name] - $colors[$colorIndex][$channel]))->toBeLessThan(25);
        }
    }
    imagedestroy($decoded);
})->with([
    [1, [0, 1, 2, 3]], [2, [1, 0, 3, 2]], [3, [3, 2, 1, 0]], [4, [2, 3, 0, 1]],
    [5, [0, 2, 1, 3]], [6, [2, 0, 3, 1]], [7, [3, 1, 2, 0]], [8, [1, 3, 0, 2]],
]);

test('invalid and overlarge decoded images fail without storing files', function () {
    $service = app(NewsImageOptimizer::class);
    expect(fn () => $service->store(UploadedFile::fake()->createWithContent('fake.png', 'invalid')))->toThrow(ValidationException::class);
    $large = UploadedFile::fake()->image('large.png', 6000, 4100);
    expect(fn () => $service->store($large))->toThrow(ValidationException::class);
    expect(Storage::disk('public')->allFiles())->toBe([]);
});

test('storage failures return a field validation error', function () {
    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('exists')->andReturn(false);
    $disk->shouldReceive('put')->andReturn(false);
    Storage::shouldReceive('disk')->with('public')->andReturn($disk);
    try {
        app(NewsImageOptimizer::class)->store(UploadedFile::fake()->image('test.png'), 'news-images', 'cover_photo');
        $this->fail('Expected storage validation failure');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('cover_photo');
    }
});

test('assistant uploads save WebP URLs and reset crops on the configured media disk', function (string $extension, string $diskName) {
    Storage::fake($diskName);
    config(['filesystems.news_media_disk' => $diskName]);
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $draft = IntelligentNewsDraft::create(['created_by' => $user->getKey(), 'status' => 'draft', 'title' => 'Berita', 'content' => 'Isi berita.', 'excerpt' => 'Ringkasan.', 'labels' => [], 'sources_used' => [], 'warnings' => [], 'version' => 1, 'image_crops' => ['sync' => true], 'image_variants' => ['website' => 'https://example.com/old.jpg']]);
    $this->actingAs($user)->post('/admin/ai-assistant/drafts/'.$draft->id.'/image', ['image' => UploadedFile::fake()->image('photo.'.$extension, 2000, 1000)])
        ->assertSessionHasNoErrors()->assertRedirect();
    $path = Storage::disk($diskName)->allFiles()[0];
    expect($draft->fresh()->image)->toBe(Storage::disk($diskName)->url($path))
        ->and($draft->fresh()->image_crops)->toBeNull()
        ->and($draft->fresh()->image_variants)->toBeNull()
        ->and(getimagesizefromstring(Storage::disk($diskName)->get($path))['mime'])->toBe('image/webp');
    if ($diskName !== 'public') {
        expect(Storage::disk('public')->allFiles())->toBe([]);
    }
    Http::assertNothingSent();
})->with(['jpg', 'png'])->with(['public', 's3']);

test('manual covers persist real WebP references on local and cloud disks without rewriting legacy images', function (string $extension, string $diskName) {
    Storage::fake($diskName);
    config(['filesystems.news_media_disk' => $diskName]);
    $disk = Storage::disk($diskName);
    $legacyUpload = UploadedFile::fake()->image('old.png');
    $legacy = file_get_contents($legacyUpload->getRealPath());
    $disk->put('news-images/old.png', $legacy);
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $this->actingAs($user)->post('/admin/news/manual', ['intent' => 'draft', 'headline' => 'Cover WebP', 'cover_photo' => UploadedFile::fake()->image('cover.'.$extension, 2400, 1200)])->assertSessionHasNoErrors();
    $draft = IntelligentNewsDraft::sole();
    $path = 'news-images/'.basename($draft->image);
    expect($path)->toEndWith('.webp')
        ->and($disk->mimeType($path))->toBe('image/webp')
        ->and(array_slice(getimagesizefromstring($disk->get($path)), 0, 3))->toBe([1920, 960, IMAGETYPE_WEBP])
        ->and($disk->get('news-images/old.png'))->toBe($legacy);
    Http::assertNothingSent();
})->with(['jpg', 'png'])->with(['public', 's3']);

test('WebP encoding uses GD quality 80 and sends correct object metadata', function () {
    $image = imagecreatetruecolor(80, 40);
    imagefill($image, 0, 0, imagecolorallocate($image, 160, 50, 90));
    ob_start();
    imagewebp($image, null, 80);
    $expected = ob_get_clean();
    expect(NewsImageOptimizer::QUALITY)->toBe(80)
        ->and(NewsImageOptimizer::MAX_WIDTH)->toBe(1920)
        ->and(NewsImageOptimizer::encodeWebp($image))->toBe($expected);
    imagedestroy($image);
    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('exists')->andReturn(false);
    $disk->shouldReceive('put')->once()->withArgs(fn ($path, $bytes, $options) => str_ends_with($path, '.webp')
        && (new finfo(FILEINFO_MIME_TYPE))->buffer($bytes) === 'image/webp'
        && $options === ['visibility' => 'public', 'ContentType' => 'image/webp'])->andReturn(true);
    Storage::shouldReceive('disk')->with('public')->andReturn($disk);
    app(NewsImageOptimizer::class)->store(UploadedFile::fake()->image('cover.png'));
    Http::assertNothingSent();
});

test('website crops preserve transparency while social crops flatten onto white JPEG', function () {
    $image = imagecreatetruecolor(40, 40);
    imagealphablending($image, false);
    imagesavealpha($image, true);
    imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
    $bytes = NewsImageOptimizer::encodeWebp($image);
    imagedestroy($image);
    Storage::disk('public')->put('news-images/alpha.webp', $bytes);
    $settings = array_fill_keys(['website', 'facebook', 'instagram'], ['x' => 0.5, 'y' => 0.5, 'zoom' => 1]);
    $variants = app(NewsImageCropService::class)->generate('/storage/news-images/alpha.webp', $settings);
    foreach ($variants as $platform => $url) {
        $output = Storage::disk('public')->get('news-images/crops/'.basename($url));
        $decoded = imagecreatefromstring($output);
        $pixel = imagecolorsforindex($decoded, imagecolorat($decoded, 10, 10));
        if ($platform === 'website') {
            expect($pixel['alpha'])->toBe(127)->and(getimagesizefromstring($output)['mime'])->toBe('image/webp');
        } else {
            expect($pixel['alpha'])->toBe(0)->and($pixel['red'])->toBeGreaterThan(250)
                ->and(getimagesizefromstring($output)['mime'])->toBe('image/jpeg');
        }
        imagedestroy($decoded);
    }
});

test('OCR image uploads retain original bytes MIME and hashes without WebP conversion', function (string $extension) {
    Storage::fake('local');
    config(['filesystems.default' => 'local']);
    Queue::fake();
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $upload = UploadedFile::fake()->image('scan.'.$extension, 100, 100);
    $original = file_get_contents($upload->getRealPath());
    $this->actingAs($user)->post(route('admin.documents.store'), ['documents' => [$upload]])->assertSessionHasNoErrors()->assertRedirect();
    $document = IntelligenceDocument::sole();
    expect(Storage::disk('local')->get($document->storage_path))->toBe($original)
        ->and($document->mime_type)->toBe($extension === 'png' ? 'image/png' : 'image/jpeg')
        ->and($document->sha256)->toBe(hash('sha256', $original))
        ->and(Storage::disk('public')->allFiles())->toBe([]);
    Http::assertNothingSent();
})->with(['jpg', 'png']);
