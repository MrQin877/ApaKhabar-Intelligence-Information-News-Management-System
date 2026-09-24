<?php

use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Http\Testing\File;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function manualCover(): File
{
    return UploadedFile::fake()->createWithContent('cover.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='));
}

function manualArticle(array $overrides = []): array
{
    return array_replace([
        'headline' => 'Berita kegiatan warga',
        'subheadline' => 'Kegiatan bersama',
        'summary' => 'Ringkasan berita untuk warga.',
        'content' => '<p>Warga berkumpul untuk kegiatan bersama hari ini.</p>',
        'content_format' => 'html',
        'show_on_homepage' => false,
        'intent' => 'draft',
        'platforms' => ['website'],
    ], $overrides);
}

beforeEach(function () {
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
});

test('manual editor saves formatting and cover without publishing', function () {
    Storage::fake('public');
    config(['filesystems.news_media_disk' => 'public']);
    $this->post('/admin/news/manual', manualArticle([
        'cover_photo' => manualCover(),
        'content' => '<p style="text-align: center" onclick="alert(1)"><strong>Kegiatan warga hari ini berjalan dengan baik.</strong></p><script>alert(1)</script><ul><li>Agenda pertama</li></ul>',
    ]))->assertSessionHasNoErrors()->assertRedirect();
    $draft = IntelligentNewsDraft::sole();
    expect($draft->status)->toBe('draft')
        ->and($draft->show_on_homepage)->toBeFalse()
        ->and(implode('', $draft->body))->toContain('<strong>', 'text-align: center', '<ul>')->not->toContain('script', 'onclick', 'alert(1)')
        ->and(News::count())->toBe(0);
    Storage::disk('public')->assertExists('news-images/'.basename($draft->image));
    $this->get('/admin/news/manual/'.$draft->id.'/edit')->assertInertia(fn (Assert $page) => $page
        ->component('admin/intelligentnewscreator/editor')->where('draft.show_on_homepage', false)->has('draft.content_html'));
});

test('manual publishing saves the current fields and homepage preference', function () {
    $this->post('/admin/news/manual', manualArticle(['intent' => 'publish']))
        ->assertSessionHasNoErrors()->assertRedirect('/admin/news');
    $news = News::sole();
    expect($news->title)->toBe('Berita kegiatan warga')->and($news->show_on_homepage)->toBeFalse();
    expect(IntelligentNewsDraft::sole()->status)->toBe('published');
    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('featuredNews', null)->has('newsList', 0));
    $this->get('/news/'.$news->getKey())->assertOk();
});

test('multipart updates persist a replacement cover and invalidate prior review', function () {
    Storage::fake('public');
    config(['filesystems.news_media_disk' => 'public']);
    $this->post('/admin/news/manual', manualArticle())->assertSessionHasNoErrors();
    $draft = IntelligentNewsDraft::sole();
    $draft->update(['reviewed_at' => now()]);
    $this->post('/admin/news/manual/'.$draft->id, manualArticle([
        '_method' => 'put', 'headline' => 'Judul diperbarui', 'show_on_homepage' => true,
        'cover_photo' => manualCover(),
    ]))->assertSessionHasNoErrors();
    expect($draft->fresh()->headline)->toBe('Judul diperbarui')
        ->and($draft->fresh()->show_on_homepage)->toBeTrue()
        ->and($draft->fresh()->reviewed_at)->toBeNull();
});

test('manual editor rejects unsupported and oversized covers', function () {
    $this->post('/admin/news/manual', manualArticle(['cover_photo' => manualCover()->size(5121)]))
        ->assertSessionHasErrors('cover_photo');
    $this->post('/admin/news/manual', manualArticle(['cover_photo' => UploadedFile::fake()->create('cover.svg', 2, 'image/svg+xml')]))
        ->assertSessionHasErrors('cover_photo');
    expect(IntelligentNewsDraft::count())->toBe(0);
});

test('formatting markup cannot satisfy the minimum article length', function () {
    $this->post('/admin/news/manual', manualArticle(['content' => '<p><strong><em><u> </u></em></strong></p>']))
        ->assertSessionHasErrors('content');
});

test('another author cannot update or publish a manual draft', function () {
    $this->post('/admin/news/manual', manualArticle())->assertSessionHasNoErrors();
    $draft = IntelligentNewsDraft::sole();
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    $this->put('/admin/news/manual/'.$draft->id, manualArticle(['intent' => 'publish']))->assertForbidden();
    expect(News::count())->toBe(0);
});

test('legacy text draft requests still save and a reviewed edit publishes current content', function () {
    $payload = manualArticle();
    unset($payload['content_format'], $payload['intent'], $payload['show_on_homepage']);
    $payload['content'] = "Paragraf pertama berita warga.\n\nParagraf kedua berita warga.";
    $this->post('/admin/news/manual', $payload)->assertSessionHasNoErrors();
    $draft = IntelligentNewsDraft::sole();
    expect($draft->body)->toBe(['Paragraf pertama berita warga.', 'Paragraf kedua berita warga.'])
        ->and($draft->show_on_homepage)->toBeTrue();
    $this->put('/admin/news/manual/'.$draft->id, manualArticle([
        'headline' => 'Judul final untuk publik', 'intent' => 'publish', 'show_on_homepage' => true,
    ]))->assertSessionHasNoErrors()->assertRedirect('/admin/news');
    expect(News::sole()->title)->toBe('Judul final untuk publik')->and(News::sole()->show_on_homepage)->toBeTrue();
});

test('publish modal receives actual website domain and disconnected social platforms', function () {
    config(['app.url' => 'https://news.example.test']);
    $this->get('/admin/news/manual/create')->assertInertia(fn (Assert $page) => $page
        ->where('publishPlatforms.0.account', 'news.example.test')
        ->where('publishPlatforms.0.status', 'connected')
        ->where('publishPlatforms.1.status', 'disconnected')
        ->where('publishPlatforms.2.status', 'disconnected'));
});

test('publishing requires a selected available platform', function (array $platforms) {
    $this->post('/admin/news/manual', manualArticle(['intent' => 'publish', 'platforms' => $platforms]))
        ->assertSessionHasErrors();
    expect(News::count())->toBe(0)->and(IntelligentNewsDraft::count())->toBe(0);
})->with([
    'none' => [[]],
    'disconnected Facebook' => [['facebook']],
    'disconnected Instagram' => [['instagram']],
    'mixed available and disconnected' => [['website', 'facebook']],
    'all while disconnected' => [['website', 'facebook', 'instagram']],
    'duplicate website' => [['website', 'website']],
]);

test('saving a draft does not require a publication selection', function () {
    $this->post('/admin/news/manual', manualArticle(['platforms' => []]))->assertSessionHasNoErrors();
    expect(IntelligentNewsDraft::sole()->status)->toBe('draft')->and(News::count())->toBe(0);
});
