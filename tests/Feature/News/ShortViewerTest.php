<?php

use App\Models\ShortVideo;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function viewerVideo(string $status = 'published'): ShortVideo
{
    $user = User::factory()->create();

    return ShortVideo::create([
        'created_by' => $user->getKey(),
        'title' => 'Video warga',
        'description' => 'Kegiatan desa',
        'video_url' => 'https://res.cloudinary.com/demo/video/upload/short.mp4',
        'video_public_id' => 'short',
        'thumbnail_url' => 'https://res.cloudinary.com/demo/video/upload/short.jpg',
        'metadata' => ['duration' => 20],
        'status' => $status,
        'published_at' => $status === 'draft' ? null : now(),
    ]);
}

function agedShortToken($test, ShortVideo $video, int $seconds = 6): string
{
    $test->withCredentials();
    $token = $test->getJson('/shorts/'.$video->id.'/view-token')->assertOk()->json('token');
    $test->withCookie(config('session.cookie'), app('session')->getId());
    $claim = json_decode(Crypt::decryptString($token), true);
    $claim['time'] -= $seconds;

    return Crypt::encryptString(json_encode($claim));
}

test('only published Shorts open and homepage carries a real zero view count without counting impressions', function () {
    $published = viewerVideo();
    $draft = viewerVideo('draft');
    $archived = viewerVideo('archived');

    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('shorts.0.id', $published->id)->where('shorts.0.view_count', 0)->has('shorts', 1));
    $this->get('/shorts/'.$published->id)->assertInertia(fn (Assert $page) => $page->component('short-viewer')->where('short.id', $published->id)->where('short.video_url', $published->video_url)->where('short.title', $published->title)->where('short.description', $published->description)->where('short.view_count', 0)->where('short.likes_count', 0)->where('commentCount', 0)->has('short.published_at'));
    $this->get('/shorts/'.$draft->id)->assertNotFound();
    $this->get('/shorts/'.$archived->id)->assertNotFound();
    $this->getJson('/shorts/'.$draft->id.'/view-token')->assertNotFound();
    expect($published->fresh()->view_count)->toBe(0)->and(DB::table('short_video_viewers')->count())->toBe(0);
});

test('viewer exposes adjacent published Shorts for swipe navigation without counting impressions', function () {
    $older = viewerVideo();
    $older->update(['published_at' => now()->subDays(2)]);
    $middle = viewerVideo();
    $middle->update(['published_at' => now()->subDay()]);
    $newer = viewerVideo();
    viewerVideo('draft');

    $this->get('/shorts/'.$middle->id)->assertInertia(fn (Assert $page) => $page
        ->where('short.id', $middle->id)
        ->where('nextShortId', $older->id)
        ->where('nextShortPreview.id', $older->id)
        ->where('previousShortId', $newer->id));
    expect(DB::table('short_video_viewers')->count())->toBe(0);
});

test('five seconds of playback challenge and unique authenticated viewer count once per Short', function () {
    $video = viewerVideo();
    $this->actingAs(User::factory()->create());
    $url = '/shorts/'.$video->id.'/view';
    $token = agedShortToken($this, $video);
    $this->postJson($url, ['token' => $token])->assertOk()->assertJsonPath('view_count', 1);
    $this->postJson($url, ['token' => $token])->assertOk()->assertJsonPath('view_count', 1);
    $this->postJson($url, ['token' => agedShortToken($this, $video)])->assertJsonPath('view_count', 1);
    expect($video->fresh()->view_count)->toBe(1)->and(DB::table('short_video_viewers')->count())->toBe(1);
    $this->actingAs(User::factory()->create());
    $this->postJson($url, ['token' => agedShortToken($this, $video)])->assertJsonPath('view_count', 2);
});

test('guest cookie deduplicates playback and invalid or early challenges never count', function () {
    $video = viewerVideo();
    $other = viewerVideo();
    $this->withCookie('short_visitor', '7bf8d84d-472d-435b-931e-7b7685b4ff5b');
    $url = '/shorts/'.$video->id.'/view';
    $this->postJson($url, ['token' => agedShortToken($this, $video, 0)])->assertUnprocessable();
    $this->postJson($url, ['token' => 'forged'])->assertUnprocessable();
    $token = agedShortToken($this, $video);
    $this->postJson('/shorts/'.$other->id.'/view', ['token' => $token])->assertUnprocessable();
    $this->postJson($url, ['token' => $token])->assertJsonPath('view_count', 1);
    $this->postJson($url, ['token' => agedShortToken($this, $video)])->assertJsonPath('view_count', 1);
    $this->withCookie('short_visitor', 'c9678fd5-d1da-41be-8f97-c08404a51075');
    $this->postJson($url, ['token' => agedShortToken($this, $video)])->assertJsonPath('view_count', 2);
    $this->postJson($url, ['token' => agedShortToken($this, $video, 7201)])->assertUnprocessable();
    expect($video->fresh()->view_count)->toBe(2);

    $beforeArchive = agedShortToken($this, $video);
    $video->update(['status' => 'archived']);
    $this->postJson($url, ['token' => $beforeArchive])->assertNotFound();
    $this->get('/shorts/'.$video->id)->assertNotFound();
});
