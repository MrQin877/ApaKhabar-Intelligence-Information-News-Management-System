<?php

use App\Http\Controllers\Admin\NewsCreatorController;
use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\NewsCategory;
use App\Models\User;
use App\Models\UserRole;
use App\Support\ArticleText;
use App\Support\NewsImageUrl;
use Illuminate\Http\Testing\File;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function manualCover(): File
{
    return UploadedFile::fake()->image('cover.png', 100, 100);
}

function manualArticle(array $overrides = []): array
{
    return array_replace([
        'headline' => 'Berita kegiatan warga',
        'category_id' => NewsCategory::firstOrCreate(['name' => 'Pengumuman'], ['slug' => 'pengumuman', 'status' => 'active'])->getKey(),

        'content' => '<p>Warga berkumpul untuk kegiatan bersama hari ini.</p>',
        'content_format' => 'html',
        'show_on_homepage' => false,
        'intent' => 'draft',
        'platforms' => ['website'],
    ], $overrides);
}

beforeEach(function () {
    config(['services.facebook.page_id' => null, 'services.facebook.page_access_token' => null]);
    config(['services.instagram.user_id' => null, 'services.instagram.access_token' => null, 'services.instagram.public_base_url' => null]);
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
});

test('news previews are generated from full content and website details keep the full article', function () {
    $content = '<p>Kalimat pertama yang bermakna.</p><p>Kalimat kedua tetap tersedia di halaman berita.</p>';
    $this->postJson('/admin/news/manual', manualArticle(['intent' => 'publish', 'content' => $content]))->assertOk();
    $news = News::sole();
    $this->get('/admin/news')->assertInertia(fn (Assert $page) => $page
        ->where('items.0.preview', 'Kalimat pertama yang bermakna.'));
    $this->get('/news/'.$news->getKey())->assertInertia(fn (Assert $page) => $page
        ->where('news.content', $content));
    $this->get('/news')->assertInertia(fn (Assert $page) => $page
        ->where('newsList.0.preview', 'Kalimat pertama yang bermakna.'));
    $news->update(['content' => '<p>Isi baru langsung mengubah pratinjau.</p>']);
    $this->get('/admin/news')->assertInertia(fn (Assert $page) => $page
        ->where('items.0.preview', 'Isi baru langsung mengubah pratinjau.'));
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

test('partial drafts save as JSON and appear in the news list with an editable draft status', function ($fields) {
    $this->postJson('/admin/news/manual', ['intent' => 'draft', 'content_format' => 'html', ...$fields])
        ->assertOk()->assertJsonPath('draft.id', 1);
    $draft = IntelligentNewsDraft::sole();
    expect($draft->status)->toBe('draft')->and($draft->reviewed_at)->toBeNull()
        ->and($draft->published_news_id)->toBeNull()->and($draft->publication_results)->toBeNull()
        ->and(News::count())->toBe(0);
    $this->get('/admin/news')->assertInertia(fn (Assert $page) => $page
        ->where('items.0.status', 'draft')
        ->where('items.0.resume_url', route('admin.news-workspace.manual.edit', $draft)));
    $this->get('/admin/news/manual/'.$draft->id.'/edit')->assertInertia(fn (Assert $page) => $page
        ->where('draft.headline', $fields['headline'] ?? '')
        ->where('draft.content_html', $fields['content'] ?? ''));
})->with([
    [['headline' => 'Judul saja']],
    [['content' => '<p>Baru mulai</p>']],
    [['content' => '<img src="https://example.com/photo.jpg" alt="Foto warga">']],
]);

test('saving a partial draft again updates its record and preserves cover crop category and inserted images', function () {
    Storage::fake('public');
    config(['filesystems.news_media_disk' => 'public']);
    $category = NewsCategory::create(['name' => 'Warga', 'is_active' => true]);
    $crop = ['x' => 0.5, 'y' => 0.5, 'zoom' => 1];
    $crops = ['sync' => true, 'website' => $crop, 'instagram' => [...$crop, 'type' => 'portrait'], 'facebook' => [...$crop, 'type' => 'portrait']];
    $response = $this->postJson('/admin/news/manual', [
        'intent' => 'draft', 'content_format' => 'html', 'content' => '<p>Awal</p>',
        'cover_photo' => UploadedFile::fake()->image('cover.png', 1080, 1350), 'category_id' => $category->getKey(), 'image_crops' => $crops,
    ])->assertOk()->json('draft');
    $content = '<h2>Subjudul</h2><p>Ringkasan</p><img src="https://example.com/image.jpg" alt="Warga">';
    $this->postJson('/admin/news/manual/'.$response['id'], [
        '_method' => 'put', 'intent' => 'draft', 'headline' => 'Judul baru', 'content_format' => 'html',
        'content' => $content, 'image' => $response['image'], 'image_crops' => $crops, 'category_id' => $category->getKey(),
    ])->assertOk()->assertJsonPath('draft.id', $response['id']);
    $draft = IntelligentNewsDraft::sole();
    expect($draft->title)->toBe('Judul baru')->and($draft->image)->toBe($response['image'])
        ->and($draft->content)->toBe($content)->and($draft->image_crops)->toBe($crops)
        ->and($draft->category_id)->toBe($category->getKey())->and($draft->status)->toBe('draft')
        ->and(News::count())->toBe(0);
    $this->get('/admin/news/manual/'.$draft->id.'/edit')->assertInertia(fn (Assert $page) => $page
        ->where('draft.content_html', $content)->where('draft.image_crops', $crops)->where('draft.image', $response['image']));
});

test('partial drafts still cannot prepare a publication preview and failed updates retain saved data', function () {
    $this->postJson('/admin/news/manual', ['intent' => 'draft', 'headline' => 'Belum selesai'])->assertOk();
    $draft = IntelligentNewsDraft::sole();
    $this->postJson('/admin/news/manual/preview', ['headline' => 'Belum selesai', 'content' => '<p>Awal</p>', 'content_format' => 'html'])
        ->assertUnprocessable()->assertJsonValidationErrors('content');
    $this->putJson('/admin/news/manual/'.$draft->id, ['intent' => 'draft', 'headline' => str_repeat('a', 256)])
        ->assertUnprocessable();
    expect($draft->fresh()->title)->toBe('Belum selesai')->and(IntelligentNewsDraft::count())->toBe(1)
        ->and(News::count())->toBe(0);
});

test('manual publishing saves the current fields and homepage preference', function () {
    $this->post('/admin/news/manual', manualArticle(['intent' => 'publish']))
        ->assertSessionHasNoErrors()->assertRedirect('/admin/news/manual/1/edit')
        ->assertSessionHas('publishResult.success', true)
        ->assertSessionHas('publishResult.results.application.success', true)
        ->assertSessionHas('publishResult.completion_url', route('admin.news-workspace.index'));
    $this->get('/admin/news/manual/1/edit')->assertInertia(fn (Assert $page) => $page
        ->where('publishResult.success', true)
        ->where('publishResult.results.application.success', true));
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

test('manual multipart publishing returns final JSON without a redirect or flashed dialog', function () {
    $this->withHeader('Accept', 'application/json')
        ->post('/admin/news/manual', manualArticle(['intent' => 'publish']))
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('results.application.success', true)
        ->assertJsonPath('completion_url', route('admin.news-workspace.index'))
        ->assertSessionMissing('publishResult');
    expect(News::count())->toBe(1);
});

test('manual JSON validation returns failed platform results without a stale flashed dialog', function () {
    $this->postJson('/admin/news/manual', manualArticle(['intent' => 'publish', 'headline' => '']))
        ->assertUnprocessable()
        ->assertJsonPath('results.application.success', false)
        ->assertJsonValidationErrors('headline')
        ->assertSessionMissing('publishResult');
    expect(News::count())->toBe(0);
});

test('manual editor rejects unsupported and oversized covers', function () {
    $this->post('/admin/news/manual', manualArticle(['cover_photo' => manualCover()->size(5121)]))
        ->assertSessionHasErrors('cover_photo');
    $this->post('/admin/news/manual', manualArticle(['cover_photo' => UploadedFile::fake()->create('cover.svg', 2, 'image/svg+xml')]))
        ->assertSessionHasErrors('cover_photo');
    expect(IntelligentNewsDraft::count())->toBe(0);
});

test('formatting markup cannot satisfy the minimum article length for publishing', function () {
    $this->post('/admin/news/manual', manualArticle(['intent' => 'publish', 'content' => '<p><strong><em><u> </u></em></strong></p>']))
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
    ]))->assertSessionHasNoErrors()->assertRedirect('/admin/news/manual/'.$draft->id.'/edit');
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
    'mixed available and disconnected' => [['website', 'facebook']],
    'all while disconnected' => [['website', 'facebook', 'instagram']],
    'duplicate website' => [['website', 'website']],
]);

test('saving a draft does not require a publication selection', function () {
    $this->post('/admin/news/manual', manualArticle(['platforms' => []]))->assertSessionHasNoErrors();
    expect(IntelligentNewsDraft::sole()->status)->toBe('draft')->and(News::count())->toBe(0);
});

test('manual covers use the configured app URL instead of the request host', function () {
    Storage::fake('public');
    config(['app.url' => 'http://192.168.1.10:8000', 'filesystems.news_media_disk' => 'public']);
    $this->post('/admin/news/manual', manualArticle(['cover_photo' => manualCover()]))
        ->assertSessionHasNoErrors();

    expect(IntelligentNewsDraft::sole()->image)->toStartWith('http://192.168.1.10:8000/storage/news-images/');
});

test('legacy local news images are normalized for API and web without rewriting records', function () {
    config(['app.url' => 'http://192.168.1.10:8000']);
    $this->post('/admin/news/manual', manualArticle(['intent' => 'publish']))->assertSessionHasNoErrors();
    $news = News::sole();
    $legacy = 'http://localhost:8000/storage/news-images/cover.png';
    $news->update(['image' => $legacy]);
    $expected = 'http://192.168.1.10:8000/storage/news-images/cover.png';

    $this->getJson('/api/news')->assertOk()->assertJsonPath('0.image', $expected);
    $this->getJson('/api/news/'.$news->getKey())->assertOk()->assertJsonPath('data.image', $expected);
    $this->get('/news/'.$news->getKey())->assertInertia(fn (Assert $page) => $page->where('news.image', '/storage/news-images/cover.png'));
    expect($news->fresh()->getRawOriginal('image'))->toBe($legacy);
    expect(NewsImageUrl::resolve('https://cdn.example.com/storage/cover.png'))
        ->toBe('https://cdn.example.com/storage/cover.png');
});

test('website pages serve original LAN images from the browser origin without changing API or stored URLs', function () {
    config(['app.url' => 'http://192.168.1.10:8000']);
    $this->post('/admin/news/manual', manualArticle(['intent' => 'publish']))->assertSessionHasNoErrors();
    $news = News::sole();
    $original = 'http://192.168.68.59:8000/storage/news-images/original.png';
    $news->update(['image' => $original, 'show_on_homepage' => true]);

    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('featuredNews.image', '/storage/news-images/original.png'));
    $this->get('/news')->assertInertia(fn (Assert $page) => $page->where('newsList.0.image', '/storage/news-images/original.png'));
    $this->get('/news/'.$news->getKey())->assertInertia(fn (Assert $page) => $page->where('news.image', '/storage/news-images/original.png'));
    $this->getJson('/api/news/'.$news->getKey())->assertJsonPath('data.image', $original);
    expect($news->fresh()->getRawOriginal('image'))->toBe($original);
    expect(NewsImageUrl::forWeb('https://cdn.example.com/storage/news-images/cover.png'))
        ->toBe('https://cdn.example.com/storage/news-images/cover.png');
    expect(NewsImageUrl::forWeb('https://res.cloudinary.com/demo/image/upload/cover.jpg'))
        ->toBe('https://res.cloudinary.com/demo/image/upload/cover.jpg');
});

test('publication preview sanitizes current content without creating a draft and publishing uses that snapshot', function () {
    $content = '<h2>Agenda warga</h2><p><strong>Kegiatan bersama</strong> berlangsung hari ini.</p><script>alert(1)</script>';
    $preview = $this->postJson('/admin/news/manual/preview', manualArticle(['content' => $content]))
        ->assertOk()->assertJsonPath('title', 'Berita kegiatan warga')->json();
    expect($preview['content'])->toContain('<h2>', '<strong>')->not->toContain('script', 'alert(1)')
        ->and($preview['caption'])->toBe(ArticleText::post($preview['title'], $preview['content']))
        ->and(IntelligentNewsDraft::count())->toBe(0)->and(News::count())->toBe(0);
    $this->postJson('/admin/news/manual', [
        'intent' => 'publish', 'platforms' => ['website'], 'preview_token' => $preview['token'],
        'headline' => 'Unreviewed replacement', 'content' => 'Unreviewed replacement content',
    ])->assertOk()->assertJsonPath('success', true);
    expect(News::sole()->title)->toBe($preview['title'])
        ->and(News::sole()->content)->toBe($preview['content']);
});

test('publication preview reports missing instagram media and rejects expired or foreign snapshots', function () {
    $preview = $this->postJson('/admin/news/manual/preview', manualArticle())->assertOk()
        ->assertJsonStructure(['issues' => ['instagram']])->json();
    $this->postJson('/admin/news/manual', ['intent' => 'publish', 'platforms' => ['website'], 'preview_token' => 'expired'])
        ->assertUnprocessable()->assertJsonValidationErrors('platforms');
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    $this->postJson('/admin/news/manual', ['intent' => 'publish', 'platforms' => ['website'], 'preview_token' => $preview['token']])
        ->assertUnprocessable()->assertJsonValidationErrors('platforms');
    expect(News::count())->toBe(0)->and(IntelligentNewsDraft::count())->toBe(0);
});

test('removing lainnya safely uncategorizes news and drafts without changing other categories', function () {
    $other = NewsCategory::create(['name' => ' Lainnya ', 'slug' => 'lainnya', 'is_default' => true]);
    $keep = NewsCategory::create(['name' => 'Pendidikan', 'slug' => 'pendidikan']);
    $this->postJson('/admin/news/manual', manualArticle(['intent' => 'publish', 'category_id' => $other->getKey()]))->assertOk();
    $this->post('/admin/news/manual', manualArticle(['category_id' => $other->getKey()]))->assertSessionHasNoErrors();
    $this->post('/admin/news/manual', manualArticle(['headline' => 'Berita pendidikan', 'category_id' => $keep->getKey()]))->assertSessionHasNoErrors();
    $before = News::sole()->content;
    $migration = require database_path('migrations/2026_10_01_000001_remove_lainnya_news_category.php');
    $migration->up();
    $migration->up();
    expect(NewsCategory::find($other->getKey()))->toBeNull()
        ->and(News::sole()->category_id)->toBeNull()
        ->and(News::sole()->content)->toBe($before)
        ->and(IntelligentNewsDraft::where('title', 'Berita kegiatan warga')->whereNotNull('category_id')->count())->toBe(0)
        ->and(IntelligentNewsDraft::where('title', 'Berita pendidikan')->sole()->category_id)->toBe($keep->getKey());
    $this->get('/admin/categories')->assertInertia(fn (Assert $page) => $page->where('categories', fn ($categories) => collect($categories)->every(fn ($category) => trim(mb_strtolower($category['name'])) !== 'lainnya')));
});

test('lainnya is not seeded or recreated through category management', function () {
    expect(NewsCategory::whereRaw('LOWER(TRIM(name)) = ?', ['lainnya'])->exists())->toBeFalse();
    $this->postJson('/admin/categories', ['name' => ' LAINNYA '])->assertUnprocessable()->assertJsonValidationErrors('name');
});

test('category activation controls selectors but never published news visibility', function () {
    $category = NewsCategory::create(['name' => 'Lingkungan', 'slug' => 'lingkungan-status']);
    $this->postJson('/admin/news/manual', manualArticle(['intent' => 'publish', 'category_id' => $category->getKey()]))->assertOk();
    $news = News::sole();
    $this->putJson('/admin/categories/'.$category->getKey(), ['name' => $category->name, 'status' => 'inactive'])
        ->assertOk()->assertJsonPath('category.is_active', false)->assertJsonPath('category.status', 'inactive');
    expect($category->fresh()->is_active)->toBeFalse();
    $this->getJson('/api/categories')->assertJsonMissing(['name' => $category->name]);
    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('categories', fn ($items) => ! collect($items)->contains($category->name)));
    $this->get('/admin/news/manual/create')->assertInertia(fn (Assert $page) => $page->where('categories', fn ($items) => ! collect($items)->contains('categoryID', $category->getKey())));
    $this->get('/admin/categories')->assertInertia(fn (Assert $page) => $page->where('categories', fn ($items) => collect($items)->contains(fn ($item) => $item['id'] === $category->getKey() && $item['status'] === 'inactive')));
    $this->get('/news/'.$news->getKey())->assertOk()->assertInertia(fn (Assert $page) => $page->where('news.category', $category->name));
    expect($news->fresh()->status)->toBe('active')->and($news->fresh()->category_id)->toBe($category->getKey());
    $this->postJson('/admin/news/manual/preview', manualArticle(['category_id' => $category->getKey()]))->assertUnprocessable()->assertJsonValidationErrors('category_id');
    $this->putJson('/admin/categories/'.$category->getKey(), ['name' => $category->name, 'status' => 'active'])->assertOk();
    $this->getJson('/api/categories')->assertJsonFragment(['name' => $category->name]);
    $this->get('/admin/news/manual/create')->assertInertia(fn (Assert $page) => $page->where('categories', fn ($items) => collect($items)->contains('categoryID', $category->getKey())));
});

test('soft deleting an in-use category preserves news and draft relationships and permits a unique replacement slug', function () {
    $category = NewsCategory::create(['name' => 'Pendidikan', 'slug' => 'pendidikan']);
    $this->postJson('/admin/news/manual', manualArticle(['intent' => 'publish', 'category_id' => $category->getKey()]))->assertOk();
    $this->post('/admin/news/manual', manualArticle(['category_id' => $category->getKey()]))->assertSessionHasNoErrors();
    $news = News::sole();
    $this->deleteJson('/admin/categories/'.$category->getKey())->assertNoContent();
    $this->assertSoftDeleted('news_categories', ['categoryID' => $category->getKey()]);
    expect($news->fresh()->categoryRecord->name)->toBe('Pendidikan')
        ->and($news->fresh()->status)->toBe('active')
        ->and(IntelligentNewsDraft::where('status', 'draft')->sole()->category->name)->toBe('Pendidikan');
    $this->get('/news/'.$news->getKey())->assertOk()->assertInertia(fn (Assert $page) => $page->where('news.category', 'Pendidikan'));
    $this->getJson('/api/categories')->assertJsonMissing(['name' => 'Pendidikan']);
    $this->get('/admin/categories')->assertInertia(fn (Assert $page) => $page->where('categories', fn ($items) => ! collect($items)->contains('id', $category->getKey())));
    $this->postJson('/admin/news/manual/preview', manualArticle(['category_id' => $category->getKey()]))->assertUnprocessable()->assertJsonValidationErrors('category_id');
    $this->postJson('/admin/categories', ['name' => 'Pendidikan'])->assertCreated()->assertJsonPath('category.slug', 'pendidikan-2');
});

test('AI category resolution ignores inactive and deleted categories including when none remain', function () {
    $inactive = NewsCategory::create(['name' => 'Pendidikan', 'slug' => 'pendidikan-ai', 'is_active' => false]);
    $deleted = NewsCategory::create(['name' => 'Lingkungan', 'slug' => 'lingkungan-ai']);
    $deleted->delete();
    $active = NewsCategory::create(['name' => 'Pengumuman', 'slug' => 'pengumuman-ai']);
    $method = new ReflectionMethod(NewsCreatorController::class, 'resolveCategoryId');
    $controller = app(NewsCreatorController::class);
    expect($method->invoke($controller, ['category' => $inactive->name]))->toBe($active->getKey());
    $active->update(['is_active' => false]);
    expect($method->invoke($controller, ['category' => $deleted->name]))->toBeNull();
});

test('inline category creation returns an active selection shared by manual editor and category management', function () {
    $category = $this->postJson('/admin/categories', [
        'name' => 'Kegiatan Komunitas',
        'description' => 'Berita kegiatan warga setempat.',
        'status' => 'active',
        'display_order' => 7,
    ])->assertCreated()->assertJsonPath('category.is_active', true)
        ->assertJsonPath('category.display_order', 7)->json('category');

    $this->get('/admin/news/manual/create')->assertInertia(fn (Assert $page) => $page
        ->where('categories', fn ($items) => collect($items)->contains('categoryID', $category['categoryID'])));
    $this->get('/admin/categories')->assertInertia(fn (Assert $page) => $page
        ->where('categories', fn ($items) => collect($items)->contains(fn ($item) => $item['id'] === $category['categoryID'] && $item['name'] === $category['name'])));
    $this->postJson('/admin/categories', ['name' => 'Kegiatan Komunitas'])
        ->assertUnprocessable()->assertJsonValidationErrors('name');
    expect(NewsCategory::where('name', 'Kegiatan Komunitas')->count())->toBe(1);
});

test('manual publication and preview require a category but drafts may omit it', function () {
    $article = manualArticle(['category_id' => null]);
    $this->postJson('/admin/news/manual', [...$article, 'intent' => 'publish'])
        ->assertUnprocessable()->assertJsonValidationErrors('category_id');
    $this->postJson('/admin/news/manual/preview', $article)
        ->assertUnprocessable()->assertJsonValidationErrors('category_id');
    expect(News::count())->toBe(0);
    $this->postJson('/admin/news/manual', $article)->assertOk();
    expect(IntelligentNewsDraft::sole()->category_id)->toBeNull();
});

test('manual publication rechecks the category in a cached preview', function () {
    $article = manualArticle();
    $preview = $this->postJson('/admin/news/manual/preview', $article)->assertOk()->json();
    NewsCategory::findOrFail($article['category_id'])->update(['is_active' => false]);
    $this->postJson('/admin/news/manual', ['intent' => 'publish', 'platforms' => ['website'], 'preview_token' => $preview['token']])
        ->assertUnprocessable()->assertJsonValidationErrors('category_id');
    expect(News::count())->toBe(0);
});

test('category creation returns the saved category and refreshed active dropdown options', function () {
    $active = NewsCategory::create(['name' => 'Existing active', 'slug' => 'existing-active', 'status' => 'active']);
    $inactive = NewsCategory::create(['name' => 'Hidden inactive', 'slug' => 'hidden-inactive', 'status' => 'inactive']);
    $response = $this->postJson('/admin/categories', ['name' => 'New inline category', 'display_order' => 0])
        ->assertCreated()->assertJsonPath('category.is_active', true);
    $newId = $response->json('category.categoryID');
    $ids = collect($response->json('categories'))->pluck('id');
    expect($ids->contains($newId))->toBeTrue()
        ->and($ids->contains($active->getKey()))->toBeTrue()
        ->and($ids->contains($inactive->getKey()))->toBeFalse();
});

test('JPEG covers produce publication previews with all platform crops', function () {
    Storage::fake('public');
    config(['filesystems.news_media_disk' => 'public']);
    $crop = ['x' => 0.5, 'y' => 0.5, 'zoom' => 1];
    $preview = $this->postJson('/admin/news/manual/preview', manualArticle([
        'cover_photo' => UploadedFile::fake()->image('cover.jpeg', 600, 400),
        'image_crops' => ['sync' => true, 'website' => $crop, 'instagram' => $crop, 'facebook' => $crop],
    ]))->assertOk()->json();

    foreach (['website', 'instagram', 'facebook'] as $platform) {
        $url = $preview['images'][$platform];
        expect($url)->toBeString()->not->toBeEmpty();
        $path = ltrim(str_replace('/storage/', '/', parse_url($url, PHP_URL_PATH)), '/');
        Storage::disk('public')->assertExists($path);
    }
    expect(News::count())->toBe(0);
});
