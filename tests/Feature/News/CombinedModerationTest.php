<?php

use App\Models\Comment;
use App\Models\News;
use App\Models\ShortVideo;
use App\Models\ShortVideoComment;
use App\Models\User;
use App\Models\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $admin = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $this->actingAs($admin);
    $this->news = News::factory()->create();
    $this->video = ShortVideo::create([
        'created_by' => $admin->getKey(), 'title' => 'Combined video', 'description' => 'Community video',
        'video_url' => 'https://example.com/video.mp4', 'video_public_id' => 'combined',
        'thumbnail_url' => 'https://example.com/cover.jpg', 'metadata' => ['duration' => 20],
        'status' => 'published', 'published_at' => now(),
    ]);
});

function combinedCommentPair($test): array
{
    return [
        Comment::create(['newsID' => $test->news->getKey(), 'content' => 'News awaiting review', 'status' => 'pending_review']),
        ShortVideoComment::create(['short_video_id' => $test->video->id, 'content' => 'Video awaiting review', 'status' => 'pending_review', 'submission_hash' => hash('sha256', uniqid('combined-', true))]),
    ];
}

test('all content combines both types without losing identical numeric IDs', function () {
    [$news, $video] = combinedCommentPair($this);
    expect($news->getKey())->toBe($video->id);
    $this->get('/admin/comments?content_type=all')->assertInertia(fn (Assert $page) => $page
        ->has('comments.data', 2)->where('comments.total', 2)->where('counts.pending', 2)
        ->where('filters.content_type', 'all')
        ->where('comments.data', fn ($items) => collect($items)->pluck('content_type')->sort()->values()->all() === ['news', 'shorts']));
});

test('combined queue paginates and filters across both content types', function () {
    for ($i = 0; $i < 12; $i++) {
        combinedCommentPair($this);
    }
    $this->get('/admin/comments?content_type=all')->assertInertia(fn (Assert $page) => $page
        ->has('comments.data', 20)->where('comments.total', 24)->where('comments.last_page', 2));
    $this->get('/admin/comments?content_type=all&page=2')->assertInertia(fn (Assert $page) => $page->has('comments.data', 4));
    $this->get('/admin/comments?content_type=all&search=Video')->assertInertia(fn (Assert $page) => $page
        ->has('comments.data', 12)->where('comments.total', 12));
});

test('flagging hides news immediately and approval restores its public visibility', function () {
    $comment = Comment::create(['newsID' => $this->news->getKey(), 'content' => 'Flag this comment', 'status' => 'published']);
    $url = '/admin/news/'.$this->news->getKey().'/moderation-comments/'.$comment->getKey().'/flag';
    $this->postJson($url, ['category' => 'spam'])->assertOk()
        ->assertJsonPath('message', 'Komentar berhasil dikirim untuk ditinjau dan disembunyikan sementara.');
    $this->getJson('/news/'.$this->news->getKey())->assertJsonPath('data.comments', 0);
    $this->get('/admin/comments?content_type=all&source=admin')->assertInertia(fn (Assert $page) => $page->has('comments.data', 1));
    $this->postJson('/admin/comments/'.$comment->getKey().'/decision', ['action' => 'allow', 'expected_revision' => 0])->assertOk();
    $this->getJson('/news/'.$this->news->getKey())->assertJsonPath('data.comments', 1);
    $this->get('/admin/comments?content_type=all&tab=history')->assertInertia(fn (Assert $page) => $page->has('comments.data', 1));
});
