<?php

use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use App\Services\CloudinaryService;
use App\Services\InstagramImageService;
use App\Services\InstagramService;
use App\Services\News\MetaConnections;
use App\Support\PublishLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

function instagramJpeg(int $width = 100, int $height = 100): string
{
    $image = imagecreatetruecolor($width, $height);
    imagefill($image, 0, 0, imagecolorallocate($image, 200, 20, 20));
    ob_start();
    imagejpeg($image, null, 95);
    $bytes = ob_get_clean();
    imagedestroy($image);

    return $bytes;
}

function instagramSequence()
{
    $sequence = Http::sequence();
    Http::fake(['api.cloudinary.com/*' => Http::response(['resource_type' => 'image', 'format' => 'jpg', 'secure_url' => 'https://res.cloudinary.com/demo/image/upload/news.jpg']), 'https://res.cloudinary.com/*' => Http::response(instagramJpeg(1080, 1080), 200, ['Content-Type' => 'image/jpeg']), 'https://graph.instagram.com/*' => $sequence]);

    return $sequence;
}

beforeEach(function () {
    config(['services.facebook.page_id' => null, 'services.facebook.page_access_token' => null]);
    config(['services.instagram.user_id' => '12345', 'services.instagram.access_token' => 'server-secret']);
    config(['services.cloudinary.cloud_name' => 'demo', 'services.cloudinary.api_key' => 'cloud-key', 'services.cloudinary.api_secret' => 'cloud-secret']);
    config(['services.instagram.public_base_url' => 'https://public.example.com']);
    Http::preventStrayRequests();
    Http::fake(['https://images.example.com/*' => Http::response(instagramJpeg(2400, 400), 200, ['Content-Type' => 'image/jpeg'])]);
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    $this->article = [
        'headline' => 'Kegiatan warga', 'summary' => 'Ringkasan kegiatan warga.',
        'content' => '<p>Kegiatan warga berlangsung dengan lancar hari ini.</p>',
        'content_format' => 'html', 'intent' => 'publish',
        'image' => 'https://images.example.com/news.jpg', 'platforms' => ['instagram'],
    ];
});

test('manual Instagram publishing uses Cloudinary and two Meta calls and respects platform selection', function (array $platforms, int $websiteCount) {
    instagramSequence()->push(['id' => '111'])->push(['id' => '222']);
    $this->post('/admin/news/manual', [...$this->article, 'platforms' => $platforms])
        ->assertSessionHasNoErrors()->assertRedirect('/admin/news/manual/1/edit')
        ->assertSessionHas('publishResult.success', true)
        ->assertSessionHas('publishResult.results.instagram.success', true)
        ->assertSessionHas('publishResult.completion_url', route('admin.news-workspace.index'));
    expect(News::count())->toBe($websiteCount);
    expect(IntelligentNewsDraft::sole()->status)->toBe('published');
    Http::assertSentCount(5);
    Http::assertSent(fn ($r) => str_ends_with($r->url(), '/12345/media') && $r['image_url'] === 'https://res.cloudinary.com/demo/image/upload/news.jpg' && $r['caption'] === "Kegiatan warga\n\nRingkasan kegiatan warga." && $r['access_token'] === 'server-secret');
    Http::assertSent(fn ($r) => str_ends_with($r->url(), '/12345/media_publish') && $r['creation_id'] === '111');
})->with([[['instagram'], 0], [['website', 'instagram'], 1]]);

test('Instagram errors preserve successful website publication', function (bool $creationSucceeds, array $failure, int $status) {
    $sequence = instagramSequence();
    if ($creationSucceeds) {
        $sequence->push(['id' => '111']);
    }
    $sequence->push($failure, $status);
    $this->post('/admin/news/manual', [...$this->article, 'platforms' => ['website', 'instagram']])
        ->assertSessionHas('publishResult.success', false)
        ->assertSessionHas('publishResult.results.application.success', true)
        ->assertSessionHas('publishResult.results.instagram.success', false);
    expect(News::count())->toBe(1);
    expect(IntelligentNewsDraft::sole()->status)->toBe('draft');
    Http::assertSentCount($creationSucceeds ? 5 : 4);
})->with([
    [false, ['error' => ['code' => 190]], 400],
    [false, ['error' => ['code' => 100]], 400],
    [false, [], 200],
    [true, ['error' => ['code' => 100]], 400],
    [true, [], 200],
]);

test('Instagram rejects local media without calling Meta', function (string $url) {
    Http::fake();
    expect(fn () => app(InstagramService::class)->publish($url, 'News caption'))
        ->toThrow(ValidationException::class);
    Http::assertNothingSent();
})->with(['/storage/a.jpg', 'file:///tmp/a.jpg']);

test('Instagram uploads local images through Cloudinary', function (string $origin) {
    Storage::fake('public');
    Storage::disk('public')->put('news-images/cover.jpg', instagramJpeg(200, 1200));
    instagramSequence()->push(['id' => '111'])->push(['id' => '222']);
    $this->post('/admin/news/manual', [...$this->article, 'image' => $origin.'/storage/news-images/cover.jpg?v=1'])
        ->assertSessionHasNoErrors();
    Http::assertSent(fn ($r) => str_ends_with($r->url(), '/media')
        && $r['image_url'] === 'https://res.cloudinary.com/demo/image/upload/news.jpg');
})->with(['http://192.168.68.59:8000', 'http://localhost:8000', 'http://127.0.0.1:8000', 'http://10.0.0.2', 'http://[::1]:8000']);

test('Instagram converts PNG uploads to a separate public JPEG and preserves the original', function () {
    Storage::fake('public');
    $image = imagecreatetruecolor(10, 10);
    ob_start();
    imagepng($image);
    $png = ob_get_clean();
    imagedestroy($image);
    config(['services.instagram.public_base_url' => null]);
    Storage::disk('public')->put('news-images/original.png', $png);
    instagramSequence()->push(['id' => '111'])->push(['id' => '222']);

    $id = app(InstagramService::class)->publish(
        'https://app.example.com/storage/news-images/original.png', 'News caption',
    );

    expect($id)->toBe('222');
    Http::assertSent(fn ($request) => str_contains($request->url(), 'api.cloudinary.com')
        && str_contains($request->body(), app(InstagramImageService::class)->normalizeJpeg(Storage::disk('public')->get('news-images/instagram/'.hash('sha256', $png).'.jpg'))));
    expect(Storage::disk('public')->get('news-images/original.png'))->toBe($png);
    $jpegPaths = collect(Storage::disk('public')->allFiles('news-images/instagram'));
    expect($jpegPaths)->toHaveCount(1);
    expect($jpegPaths->first())->toEndWith('.jpg');
    expect(getimagesizefromstring(Storage::disk('public')->get($jpegPaths->first()))['mime'])->toBe('image/jpeg');
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/media')
        && $request['image_url'] === 'https://res.cloudinary.com/demo/image/upload/news.jpg');
});

test('Instagram normalizes remote JPEG images without modifying website storage', function () {
    Storage::fake('public');
    instagramSequence()->push(['id' => '111'])->push(['id' => '222']);

    app(InstagramService::class)->publish('https://images.example.com/news.jpeg', 'News caption');

    expect(Storage::disk('public')->allFiles('news-images'))->toBe([]);
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/media')
        && $request['image_url'] === 'https://res.cloudinary.com/demo/image/upload/news.jpg');
});

test('Instagram reports failed PNG conversion without contacting Meta', function () {
    Storage::fake('public');
    Storage::disk('public')->put('news-images/broken.png', 'not a valid PNG');
    Http::fake();

    expect(fn () => app(InstagramService::class)->publish(
        'https://app.example.com/storage/news-images/broken.png', 'News caption',
    ))->toThrow(ValidationException::class);

    Http::assertNothingSent();
    Storage::disk('public')->assertMissing('news-images/instagram');
});

test('missing Cloudinary configuration prevents readiness and publishing', function (?string $base) {
    config(['services.cloudinary.cloud_name' => $base]);
    Http::fake();
    expect(app(InstagramService::class)->configured())->toBeFalse();
    expect(app(MetaConnections::class)->platforms(auth()->id())[2]['status'])->toBe('disconnected');
    $this->post('/admin/news/manual', $this->article)->assertSessionHas('publishResult.results.instagram.success', false);
    Http::assertNothingSent();
})->with([null, '', 'http://localhost:8000', 'http://192.168.1.10:8000']);

test('missing Instagram credentials and Facebook selections are rejected', function () {
    Http::fake();
    config(['services.instagram.user_id' => null]);
    $this->post('/admin/news/manual', $this->article)->assertSessionHas('publishResult.results.instagram.success', false);
    $this->post('/admin/news/manual', [...$this->article, 'platforms' => ['facebook']])->assertSessionHasErrors('platforms');
    Http::assertNothingSent();
});

test('Instagram timeout is a friendly error without leaking credentials', function () {
    Http::fake(fn () => throw new ConnectionException('server-secret'));
    $this->postJson('/admin/news/manual', $this->article)->assertOk()
        ->assertJsonPath('results.instagram.success', false)->assertDontSee('server-secret');
});

test('platform metadata never exposes Instagram credentials', function () {
    $platforms = app(MetaConnections::class)->platforms(auth()->id());
    expect($platforms[2]['status'])->toBe('connected');
    expect(json_encode($platforms))->not->toContain('server-secret', '12345');
});

test('retrying a partial publication does not duplicate website news', function () {
    instagramSequence()->push(['error' => ['code' => 190]], 400)->push(['id' => '111'])->push(['id' => '222']);
    $payload = [...$this->article, 'platforms' => ['website', 'instagram']];
    $this->post('/admin/news/manual', $payload)->assertSessionHas('publishResult.results.application.success', true);
    $draft = IntelligentNewsDraft::sole();
    $this->put('/admin/news/manual/'.$draft->id, $payload)->assertSessionHas('publishResult.success', true);
    expect(News::count())->toBe(1);
    expect($draft->fresh()->instagram_media_id)->toBe('222');
    Http::assertSentCount(9);
});

test('website failure does not prevent Instagram and technical errors stay out of response', function () {
    instagramSequence()->push(['id' => '111'])->push(['id' => '222']);
    News::creating(fn () => throw new RuntimeException('database technical failure server-secret'));
    try {
        $this->postJson('/admin/news/manual', [...$this->article, 'platforms' => ['website', 'instagram']])
            ->assertOk()->assertJsonPath('success', false)
            ->assertJsonPath('results.application.success', false)
            ->assertJsonPath('results.instagram.success', true)
            ->assertDontSee('database technical failure')->assertDontSee('server-secret');
    } finally {
        News::flushEventListeners();
    }
    expect(News::count())->toBe(0);
    expect(IntelligentNewsDraft::sole()->instagram_media_id)->toBe('222');
});

test('publish stage logs redact credentials in Meta bodies and exception messages', function () {
    $records = [];
    Log::shouldReceive('log')->andReturnUsing(function ($level, $message, $context) use (&$records) {
        $records[] = [$level, $message, $context];
    });
    PublishLog::write('test', ['response_body' => ['access_token' => 'another-secret', 'error' => ['message' => 'server-secret']],
        'exception_message' => 'Authorization: Bearer another-secret', 'image_url' => 'https://example.com/a.jpg?signature=hidden']);
    $encoded = json_encode($records);
    expect($encoded)->not->toContain('server-secret', 'another-secret', 'signature=hidden')->toContain('REDACTED');
});

test('Cloudinary signs backend uploads and sends prepared JPEG bytes', function () {
    $this->freezeTime();
    Http::fake(['api.cloudinary.com/*' => Http::response(['resource_type' => 'image', 'format' => 'jpg', 'secure_url' => 'https://res.cloudinary.com/demo/image/upload/photo.jpg'])]);
    expect(app(CloudinaryService::class)->uploadJpeg('jpeg-content'))->toEndWith('photo.jpg');
    Http::assertSent(fn ($r) => $r->url() === 'https://api.cloudinary.com/v1_1/demo/image/upload'
        && str_contains($r->body(), (string) now()->timestamp)
        && str_contains($r->body(), hash('sha256', 'format=jpg&timestamp='.now()->timestamp.'cloud-secret'))
        && str_contains($r->body(), 'cloud-key')
        && ! isset($r['api_secret'])
        && str_contains($r->body(), 'jpeg-content'));
});

test('Cloudinary failures stop Meta and preserve website publication without leaking secrets', function ($body, $status) {
    Log::spy();
    Http::fake(['api.cloudinary.com/*' => Http::response($body, $status)]);
    $this->postJson('/admin/news/manual', [...$this->article, 'platforms' => ['website', 'instagram']])
        ->assertOk()->assertJsonPath('results.application.success', true)
        ->assertJsonPath('results.instagram.success', false)
        ->assertDontSee('cloud-secret')->assertDontSee('server-secret');
    expect(News::sole()->image)->toBe($this->article['image']);
    Http::assertSentCount(2);
    Log::shouldHaveReceived('log')->withArgs(fn ($level, $message, $context) => $message === 'manual_publish.cloudinary.failure'
        && ! str_contains(json_encode($context), 'cloud-secret'));
})->with([
    [['error' => ['message' => 'cloud-secret server-secret']], 401],
    [[], 200],
    [['resource_type' => 'image', 'format' => 'jpg', 'secure_url' => 'http://example.com/photo.jpg'], 200],
]);

test('Cloudinary connection failures are sanitized', function () {
    Http::fake(fn () => throw new ConnectionException('cloud-secret server-secret'));
    expect(fn () => app(CloudinaryService::class)->uploadJpeg('jpeg'))
        ->toThrow(ValidationException::class);
});

test('missing Cloudinary credentials fail without an upload', function (string $key) {
    config(['services.cloudinary.'.$key => null]);
    Http::fake();
    expect(fn () => app(CloudinaryService::class)->uploadJpeg('jpeg'))
        ->toThrow(ValidationException::class);
    Http::assertNothingSent();
})->with(['cloud_name', 'api_key', 'api_secret']);

test('Cloudinary logs the public URL without credentials', function () {
    Log::spy();
    Http::fake(['api.cloudinary.com/*' => Http::response(['resource_type' => 'image', 'format' => 'jpg', 'secure_url' => 'https://res.cloudinary.com/demo/image/upload/photo.jpg'])]);
    app(CloudinaryService::class)->uploadJpeg('jpeg');
    Log::shouldHaveReceived('log')->withArgs(fn ($level, $message, $context) => $message === 'manual_publish.cloudinary.success'
        && $context['secure_url'] === 'https://res.cloudinary.com/demo/image/upload/photo.jpg'
        && ! str_contains(json_encode($context), 'cloud-secret'));
});

test('unsupported image ratios are padded to 1080 square before Cloudinary upload', function (int $width, int $height, string $format) {
    Storage::fake('public');
    Log::spy();
    $source = instagramJpeg($width, $height);
    if ($format === 'png') {
        $image = imagecreatefromstring($source);
        ob_start();
        imagepng($image);
        $source = ob_get_clean();
        imagedestroy($image);
    }
    $path = 'news-images/wide-or-tall.'.$format;
    Storage::disk('public')->put($path, $source);
    instagramSequence()->push(['id' => '111'])->push(['id' => '222']);
    $url = rtrim(config('app.url'), '/').'/storage/'.$path;
    $this->post('/admin/news/manual', [...$this->article, 'image' => $url, 'platforms' => ['website', 'instagram']])
        ->assertSessionHas('publishResult.success', true);
    expect(News::sole()->image)->toBe($url);
    expect(Storage::disk('public')->get($path))->toBe($source);
    Http::assertSent(function ($request) use ($width, $height) {
        if (! str_contains($request->url(), 'api.cloudinary.com')) {
            return false;
        }
        preg_match('/\xFF\xD8.*?\xFF\xD9/s', $request->body(), $matches);
        $jpeg = $matches[0] ?? '';
        $dimensions = getimagesizefromstring($jpeg);
        expect($dimensions[0])->toBe(1080);
        expect($dimensions[1])->toBe(1080);
        expect($dimensions['mime'])->toBe('image/jpeg');
        $image = imagecreatefromstring($jpeg);
        // White padding at the short-axis edge and red content at the center.
        $padding = imagecolorsforindex($image, imagecolorat($image, $width > $height ? 540 : 0, $width > $height ? 0 : 540));
        $center = imagecolorsforindex($image, imagecolorat($image, 540, 540));
        expect($padding['red'])->toBeGreaterThan(245);
        expect($padding['green'])->toBeGreaterThan(245);
        expect($center['red'])->toBeGreaterThan(180);
        expect($center['green'])->toBeLessThan(40);
        imagedestroy($image);

        return true;
    });
    Http::assertSent(fn ($r) => str_ends_with($r->url(), '/media') && $r['image_url'] === 'https://res.cloudinary.com/demo/image/upload/news.jpg');
    Log::shouldHaveReceived('log')->withArgs(fn ($level, $message, $context) => $message === 'manual_publish.instagram.image_normalized'
        && $context['original_width'] === $width && $context['original_height'] === $height
        && $context['final_width'] === 1080 && $context['final_height'] === 1080);
})->with([[2400, 400, 'jpg'], [400, 2400, 'jpg'], [2400, 400, 'png'], [400, 2400, 'png']]);

test('Cloudinary probe rejects redirects, HTML, wrong MIME and invalid JPEG bytes', function (int $status, string $contentType, string $body, array $extraHeaders) {
    Log::spy();
    Http::fake(['https://res.cloudinary.com/*' => Http::response($body === 'jpeg' ? instagramJpeg(1080, 1080) : $body, $status, ['Content-Type' => $contentType, ...$extraHeaders])]);
    expect(fn () => app(InstagramImageService::class)->probeCloudinary('https://res.cloudinary.com/demo/image/upload/photo.jpg'))
        ->toThrow(ValidationException::class);
    Http::assertSentCount(1);
    Log::shouldHaveReceived('log')->withArgs(fn ($level, $message, $context) => $message === 'manual_publish.instagram.cloudinary_probe' && $context['valid'] === false);
})->with([
    [302, 'image/jpeg', 'jpeg', ['Location' => 'https://example.com/login']],
    [200, 'text/html', '<html>Login</html>', []],
    [200, 'image/webp', 'jpeg', []],
    [200, 'image/jpeg', 'not JPEG bytes', []],
    [403, 'image/jpeg', 'jpeg', []],
]);

test('media request and probe logs contain only sanitized publishing data', function () {
    Log::spy();
    instagramSequence()->push(['id' => '111'])->push(['id' => '222']);
    app(InstagramService::class)->publish($this->article['image'], 'Caption server-secret cloud-secret');
    Log::shouldHaveReceived('log')->withArgs(fn ($level, $message, $context) => $message === 'manual_publish.instagram.media.request'
        && array_keys($context['parameters']) === ['image_url', 'caption']
        && $context['parameters']['caption'] === 'Caption [REDACTED] [REDACTED]');
    Log::shouldHaveReceived('log')->withArgs(fn ($level, $message, $context) => $message === 'manual_publish.instagram.cloudinary_probe'
        && $context['http_status'] === 200 && $context['valid'] === true
        && $context['metadata']['mime'] === 'image/jpeg'
        && $context['final_url'] === 'https://res.cloudinary.com/demo/image/upload/news.jpg');
});

test('invalid delivery prevents Instagram media creation', function () {
    Http::fake([
        'api.cloudinary.com/*' => Http::response(['resource_type' => 'image', 'format' => 'jpg', 'secure_url' => 'https://res.cloudinary.com/demo/image/upload/news.jpg']),
        'https://res.cloudinary.com/*' => Http::response('<html>Login</html>', 200, ['Content-Type' => 'text/html']),
    ]);
    expect(fn () => app(InstagramService::class)->publish($this->article['image'], 'Caption'))
        ->toThrow(ValidationException::class);
    Http::assertNotSent(fn ($r) => str_contains($r->url(), 'graph.instagram.com'));
});
