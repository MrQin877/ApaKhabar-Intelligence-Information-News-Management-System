<?php

use App\Models\ShortVideo;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function videoPageShort(User $creator, string $title, int $views, string $status = 'published'): ShortVideo
{
    return ShortVideo::create([
        'created_by' => $creator->getKey(),
        'title' => $title,
        'description' => 'Kegiatan warga',
        'video_url' => 'https://res.cloudinary.com/demo/video/upload/'.$title.'.mp4',
        'video_public_id' => $title,
        'thumbnail_url' => 'https://res.cloudinary.com/demo/image/upload/'.$title.'.jpg',
        'metadata' => ['duration' => 20],
        'status' => $status,
        'published_at' => $status === 'draft' ? null : now(),
        'view_count' => $views,
    ]);
}

test('Video page ranks three published Shorts by real views and excludes them from browse', function () {
    $creator = User::factory()->create();
    $first = videoPageShort($creator, 'pertama', 15);
    $second = videoPageShort($creator, 'kedua', 40);
    $third = videoPageShort($creator, 'ketiga', 25);
    $other = videoPageShort($creator, 'lainnya', 3);
    videoPageShort($creator, 'draf', 1000, 'draft');
    videoPageShort($creator, 'arsip', 2000, 'archived');

    $this->get('/videos')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('videos')
        ->where('topShorts.0.id', $second->id)
        ->where('topShorts.1.id', $third->id)
        ->where('topShorts.2.id', $first->id)
        ->where('shorts.data.0.id', $other->id)
        ->has('topShorts', 3)
        ->has('shorts.data', 1));
    expect($second->fresh()->view_count)->toBe(40);
});

test('Video page handles fewer than three published Shorts without duplication', function () {
    $creator = User::factory()->create();
    $short = videoPageShort($creator, 'satu', 0);

    $this->get('/videos')->assertInertia(fn (Assert $page) => $page
        ->where('topShorts.0.id', $short->id)
        ->has('topShorts', 1)
        ->has('shorts.data', 0));
});

test('Video page paginates remaining published Shorts after the top three', function () {
    $creator = User::factory()->create();
    for ($index = 0; $index < 16; $index++) {
        videoPageShort($creator, 'video-'.$index, $index);
    }

    $this->get('/videos')->assertInertia(fn (Assert $page) => $page
        ->has('topShorts', 3)
        ->has('shorts.data', 12)
        ->where('shorts.last_page', 2));
    $this->get('/videos?page=2')->assertInertia(fn (Assert $page) => $page
        ->has('shorts.data', 1)
        ->where('shorts.current_page', 2));
});
