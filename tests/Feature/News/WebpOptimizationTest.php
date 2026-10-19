<?php

use App\Models\IntelligentNewsDraft;
use App\Models\User;
use App\Models\UserRole;
use App\Services\NewsImageOptimizer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
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
    ob_start(); imagepng($image); $bytes = ob_get_clean(); imagedestroy($image);
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
        $x = ($i % 2) * 40; $y = intdiv($i, 2) * 20;
        imagefilledrectangle($image, $x, $y, $x + 39, $y + 19, imagecolorallocate($image, ...$color));
    }
    ob_start(); imagejpeg($image, null, 100); $jpeg = ob_get_clean(); imagedestroy($image);
    $exif = "Exif\0\0II".pack('vV', 42, 8).pack('v', 1).pack('vvVv', 0x112, 3, 1, $orientation)."\0\0".pack('V', 0);
    $jpeg = substr($jpeg, 0, 2)."\xff\xe1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2);
    $decoded = imagecreatefromstring(app(NewsImageOptimizer::class)->convert($jpeg));
    $w = imagesx($decoded); $h = imagesy($decoded);
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
    $disk = Mockery::mock(\Illuminate\Contracts\Filesystem\Filesystem::class);
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

test('assistant uploads save WebP URLs and reset crops on the configured media disk', function () {
    Storage::fake('s3');
    config(['filesystems.news_media_disk' => 's3']);
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $draft = IntelligentNewsDraft::create(['created_by' => $user->getKey(), 'status' => 'draft', 'title' => 'Berita', 'version' => 1]);
    $this->actingAs($user)->post('/admin/ai-assistant/drafts/'.$draft->id.'/image', ['image' => UploadedFile::fake()->image('photo.jpg', 2000, 1000)])
        ->assertSessionHasNoErrors()->assertRedirect();
    $path = Storage::disk('s3')->allFiles()[0];
    expect($draft->fresh()->image)->toBe(Storage::disk('s3')->url($path))
        ->and($draft->fresh()->image_crops)->toBeNull()
        ->and($draft->fresh()->image_variants)->toBeNull()
        ->and(Storage::disk('public')->allFiles())->toBe([]);
});
