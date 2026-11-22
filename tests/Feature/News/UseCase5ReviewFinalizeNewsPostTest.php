<?php

use App\Models\IntelligentNewsDraft;
use App\Models\News;
use App\Models\NewsCategory;
use App\Models\ShortVideo;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Shorts\VideoInspector;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Http::preventStrayRequests();
    Http::fake();
    Storage::fake('public');
    config(['filesystems.news_media_disk' => 'public']);
    $this->actingAs(User::factory()->create([
        'roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey(),
    ]));
    $category = NewsCategory::firstOrCreate(['name' => 'Pengumuman'], ['slug' => 'pengumuman', 'is_active' => true]);
    $this->uc5Article = [
        'headline' => 'Community programme update', 'category_id' => $category->getKey(),
        'content' => '<p>The community programme was held at the village hall.</p>',
        'content_format' => 'html', 'intent' => 'draft', 'show_on_homepage' => false,
    ];
});

test('TC-UC5-01 saves a complete draft without publishing', function () {
    $this->postJson('/admin/news/manual', $this->uc5Article)->assertOk();
    $draft = IntelligentNewsDraft::sole();
    expect($draft->title)->toBe($this->uc5Article['headline'])
        ->and($draft->content)->toBe($this->uc5Article['content'])
        ->and($draft->status)->toBe('draft')->and($draft->published_news_id)->toBeNull()
        ->and(News::count())->toBe(0);
    Http::assertNothingSent();
});

test('TC-UC5-02 reopens saved draft content in the editor', function () {
    $this->postJson('/admin/news/manual', $this->uc5Article)->assertOk();
    $draft = IntelligentNewsDraft::sole();
    $this->get('/admin/news/manual/'.$draft->id.'/edit')->assertInertia(fn (Assert $page) => $page
        ->component('admin/intelligentnewscreator/editor')
        ->where('draft.headline', $this->uc5Article['headline'])
        ->where('draft.content_html', $this->uc5Article['content'])
        ->where('draft.show_on_homepage', false));
});

test('TC-UC5-03 updates the existing draft and invalidates its review', function () {
    $this->postJson('/admin/news/manual', $this->uc5Article)->assertOk();
    $draft = IntelligentNewsDraft::sole();
    $draft->update(['reviewed_at' => now()]);
    $updated = [...$this->uc5Article, 'headline' => 'Final community update', 'content' => '<p>The team confirmed the final programme details.</p>'];
    $this->putJson('/admin/news/manual/'.$draft->id, $updated)->assertOk();
    expect(IntelligentNewsDraft::count())->toBe(1)->and($draft->fresh()->title)->toBe($updated['headline'])
        ->and($draft->fresh()->content)->toBe($updated['content'])->and($draft->fresh()->reviewed_at)->toBeNull();
    expect(News::count())->toBe(0);
});

test('TC-UC5-04 saves and retrieves an incomplete draft', function () {
    $this->postJson('/admin/news/manual', ['intent' => 'draft', 'headline' => 'Unfinished report'])->assertOk();
    $draft = IntelligentNewsDraft::sole();
    $this->get('/admin/news/manual/'.$draft->id.'/edit')->assertInertia(fn (Assert $page) => $page
        ->where('draft.headline', 'Unfinished report')->where('draft.content_html', ''));
    expect(News::count())->toBe(0);
});

test('TC-UC5-05 lists the saved draft with a resume link', function () {
    $this->postJson('/admin/news/manual', $this->uc5Article)->assertOk();
    $draft = IntelligentNewsDraft::sole();
    $this->get('/admin/news')->assertInertia(fn (Assert $page) => $page
        ->where('items.0.status', 'draft')
        ->where('items.0.resume_url', route('admin.news-workspace.manual.edit', $draft)));
});

test('TC-UC5-06 prepares a preview without saving or publishing news', function () {
    $this->postJson('/admin/news/manual/preview', $this->uc5Article)->assertOk()
        ->assertJsonPath('title', $this->uc5Article['headline'])
        ->assertJsonPath('content', $this->uc5Article['content'])
        ->assertJsonStructure(['token', 'caption', 'images', 'issues']);
    expect(IntelligentNewsDraft::count())->toBe(0)->and(News::count())->toBe(0);
    Http::assertNothingSent();
});

test('TC-UC5-07 saves a cover image and retrieves it with the draft', function () {
    $this->post('/admin/news/manual', [...$this->uc5Article, 'cover_photo' => UploadedFile::fake()->image('cover.png', 100, 100)])
        ->assertSessionHasNoErrors()->assertRedirect();
    $draft = IntelligentNewsDraft::sole();
    Storage::disk('public')->assertExists('news-images/'.basename($draft->image));
    $this->get('/admin/news/manual/'.$draft->id.'/edit')->assertInertia(fn (Assert $page) => $page
        ->where('draft.image', $draft->image));
});

test('TC-UC5-08 rejects an oversized headline and retains the saved draft', function () {
    $this->postJson('/admin/news/manual', $this->uc5Article)->assertOk();
    $draft = IntelligentNewsDraft::sole();
    $this->putJson('/admin/news/manual/'.$draft->id, [...$this->uc5Article, 'headline' => str_repeat('a', 256)])
        ->assertUnprocessable()->assertJsonValidationErrors('headline');
    expect($draft->fresh()->title)->toBe($this->uc5Article['headline'])->and(IntelligentNewsDraft::count())->toBe(1);
});

test('TC-UC5-09 prevents another author from retrieving or changing the draft', function () {
    $this->postJson('/admin/news/manual', $this->uc5Article)->assertOk();
    $draft = IntelligentNewsDraft::sole();
    $this->actingAs(User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]));
    $this->get('/admin/news/manual/'.$draft->id.'/edit')->assertForbidden();
    $this->putJson('/admin/news/manual/'.$draft->id, [...$this->uc5Article, 'headline' => 'Unauthorized edit'])->assertForbidden();
    expect($draft->fresh()->title)->toBe($this->uc5Article['headline']);
});

test('TC-UC5-10 rejects an unsupported cover image', function () {
    $this->post('/admin/news/manual', [...$this->uc5Article, 'cover_photo' => UploadedFile::fake()->create('cover.svg', 2, 'image/svg+xml')])
        ->assertSessionHasErrors('cover_photo');
    expect(IntelligentNewsDraft::count())->toBe(0)->and(News::count())->toBe(0);
});

test('TC-UC5-11 saves a video draft and retrieves its original file and text', function () {
    Queue::fake();
    $this->mock(VideoInspector::class)->shouldReceive('inspect')->once()->andReturn([
        'format' => 'mp4', 'codec' => 'h264', 'pixel_format' => 'yuv420p',
        'width' => 1920, 'height' => 1080, 'duration' => 20, 'bytes' => 1000,
    ]);
    $response = $this->postJson('/admin/short-videos/upload', [
        'video' => UploadedFile::fake()->create('programme.mp4', 10, 'video/mp4'),
        'title' => 'Community video draft', 'description' => 'Saved programme video content',
    ])->assertCreated();
    $video = ShortVideo::findOrFail($response->json('video.id'));
    Storage::disk('public')->assertExists($video->metadata['crop_source']['path']);
    expect($video->status)->toBe('draft')->and($video->publications()->count())->toBe(0);
    $this->get('/admin/short-videos/create?draft='.$video->id)->assertInertia(fn (Assert $page) => $page
        ->where('draft.title', 'Community video draft')->where('draft.description', 'Saved programme video content')
        ->where('draft.video_url', $video->video_url));
    Http::assertNothingSent();
});

test('TC-UC5-12 updates and retrieves an existing video draft without publishing', function () {
    $video = ShortVideo::create([
        'created_by' => auth()->id(), 'title' => 'Original video title', 'description' => 'Original content',
        'video_url' => 'https://res.cloudinary.com/demo/video/upload/short.mp4', 'video_public_id' => 'short',
        'thumbnail_url' => 'https://res.cloudinary.com/demo/video/upload/so_0/short.jpg',
        'metadata' => ['width' => 1080, 'height' => 1920, 'duration' => 20],
    ]);
    $this->postJson('/admin/short-videos/'.$video->id, [
        'title' => 'Final video draft', 'description' => 'Updated saved video content', 'frame_offset' => 0, 'cover_mode' => 'keep',
    ])->assertOk();
    $this->get('/admin/short-videos/create?draft='.$video->id)->assertInertia(fn (Assert $page) => $page
        ->where('draft.title', 'Final video draft')->where('draft.description', 'Updated saved video content'));
    expect(ShortVideo::count())->toBe(1)->and($video->fresh()->status)->toBe('draft')
        ->and($video->publications()->count())->toBe(0);
    Http::assertNothingSent();
});

test('TC-UC5-13 rejects an empty video draft title and preserves saved content', function () {
    $video = ShortVideo::create([
        'created_by' => auth()->id(), 'title' => 'Saved video title', 'description' => 'Saved content',
        'video_url' => 'https://res.cloudinary.com/demo/video/upload/short.mp4', 'video_public_id' => 'short',
        'thumbnail_url' => 'https://res.cloudinary.com/demo/video/upload/so_0/short.jpg',
        'metadata' => ['width' => 1080, 'height' => 1920, 'duration' => 20],
    ]);
    $this->postJson('/admin/short-videos/'.$video->id, [
        'title' => '', 'description' => 'Changed content', 'frame_offset' => 0, 'cover_mode' => 'keep',
    ])->assertUnprocessable()->assertJsonValidationErrors('title');
    expect($video->fresh()->title)->toBe('Saved video title')->and($video->fresh()->description)->toBe('Saved content');
});
