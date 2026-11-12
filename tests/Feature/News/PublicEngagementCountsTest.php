<?php

use App\Models\Comment;
use App\Models\Like;
use App\Models\News;
use App\Models\ShortVideo;
use App\Models\ShortVideoComment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

test('news listing detail and homepage share actual likes and publicly visible thread totals', function () {
    $user = User::factory()->create();
    $news = News::factory()->create(['status' => 'active', 'show_on_homepage' => true, 'likes_count' => 99]);
    Like::create(['postID' => $news->getKey(), 'userID' => $user->getKey()]);
    $root = Comment::create(['newsID' => $news->getKey(), 'content' => 'Visible', 'status' => 'published']);
    Comment::create(['newsID' => $news->getKey(), 'parentID' => $root->getKey(), 'content' => 'Visible reply', 'status' => 'published']);
    foreach (['pending_review', 'hidden', 'removed', 'rejected'] as $status) {
        $blocked = Comment::create(['newsID' => $news->getKey(), 'content' => 'Not public', 'status' => $status]);
        Comment::create(['newsID' => $news->getKey(), 'parentID' => $blocked->getKey(), 'content' => 'Unreachable reply', 'status' => 'published']);
    }
    $this->getJson('/api/news')->assertOk()->assertJsonPath('0.likes_count', 1)
        ->assertJsonPath('0.comments_count', 2)->assertJsonPath('0.likes', 1)->assertJsonPath('0.comments', 2);
    $this->getJson('/api/news/'.$news->getKey())->assertOk()->assertJsonPath('data.likes_count', 1)
        ->assertJsonPath('data.comments_count', 2)->assertJsonCount(2, 'data.comments_list');
    $this->get('/')->assertInertia(fn (Assert $page) => $page
        ->where('remainingNews.0.likes_count', 1)->where('remainingNews.0.comments_count', 2)
        ->where('featuredSlides.0.likes_count', 1)->where('featuredSlides.0.comments_count', 2));
    $other = News::factory()->create(['status' => 'active']);
    $this->getJson('/api/news/'.$other->getKey().'/related')->assertOk()
        ->assertJsonPath('data.0.likes_count', 1)->assertJsonPath('data.0.comments_count', 2);
});

test('public shorts listings count engagement records and exclude unpublished comments and videos', function () {
    $user = User::factory()->create();
    $video = ShortVideo::create(['created_by' => $user->getKey(), 'title' => 'Public short', 'description' => 'Village',
        'video_url' => 'https://example.org/video.mp4', 'video_public_id' => 'test',
        'thumbnail_url' => 'https://example.org/cover.jpg', 'metadata' => [], 'status' => 'published', 'published_at' => now(), 'likes_count' => 99]);
    DB::table('short_video_likes')->insert(['short_video_id' => $video->id, 'user_id' => $user->getKey()]);
    $root = ShortVideoComment::create(['short_video_id' => $video->id, 'content' => 'Visible', 'status' => 'published', 'submission_hash' => hash('sha256', 'root')]);
    ShortVideoComment::create(['short_video_id' => $video->id, 'root_id' => $root->id, 'parent_id' => $root->id, 'content' => 'Reply', 'status' => 'published', 'submission_hash' => hash('sha256', 'reply')]);
    foreach (['pending_review', 'hidden', 'removed', 'rejected'] as $status) {
        ShortVideoComment::create(['short_video_id' => $video->id, 'content' => 'Not public', 'status' => $status, 'submission_hash' => hash('sha256', $status)]);
    }
    $draft = $video->replicate();
    $draft->status = 'draft';
    $draft->save();
    $this->get('/')->assertInertia(fn (Assert $page) => $page->has('shorts', 1)
        ->where('shorts.0.likes_count', 1)->where('shorts.0.comments_count', 2));
    $this->getJson('/api/shorts')->assertOk()->assertJsonCount(1, 'topShorts')
        ->assertJsonPath('topShorts.0.likes_count', 1)->assertJsonPath('topShorts.0.comments_count', 2);
    $this->getJson('/api/shorts/'.$video->id)->assertOk()->assertJsonPath('data.likes_count', 1)->assertJsonPath('data.comments_count', 2);
    $this->getJson('/api/shorts/'.$draft->id)->assertNotFound();
    for ($i = 0; $i < 3; $i++) {
        $copy = $video->replicate();
        $copy->save();
    }
    $this->getJson('/api/shorts')->assertOk()->assertJsonPath('topShorts.0.likes_count', 0)
        ->assertJsonPath('shorts.data.0.likes_count', 1)->assertJsonPath('shorts.data.0.comments_count', 2);
});

test('engagement fields are integer zeros for empty posts', function () {
    News::factory()->create(['status' => 'active', 'likes_count' => 42]);
    $this->getJson('/api/news')->assertOk()->assertJsonPath('0.likes_count', 0)->assertJsonPath('0.comments_count', 0);
});
