<?php

use App\Models\News;
use App\Models\ShortVideo;
use App\Models\User;

test('reading Shorts comments does not consume the submission or context allowance', function (bool $authenticated) {
    $owner = User::factory()->create();
    $video = ShortVideo::create([
        'created_by' => $owner->getKey(), 'title' => 'Video warga',
        'video_url' => 'https://example.test/video.mp4', 'video_public_id' => 'video',
        'thumbnail_url' => 'https://example.test/thumbnail.jpg', 'metadata' => ['duration' => 20],
        'status' => 'published',
        'published_at' => now(),
    ]);
    if ($authenticated) {
        $this->actingAs($owner);
    }
    $base = '/shorts/'.$video->id;

    for ($i = 0; $i < 31; $i++) {
        $this->getJson($base.'/comments')->assertOk();
    }
    $this->getJson($base.'/engagement')->assertOk();

    // Invalid input still consumes the anti-spam allowance, without guest bot checks.
    for ($i = 0; $i < 5; $i++) {
        $this->postJson($base.'/comments', [])->assertUnprocessable();
    }
    $this->postJson($base.'/comments', [])->assertStatus(429)->assertHeader('Retry-After');
    $this->getJson($base.'/comments')->assertOk();
    $this->getJson($base.'/engagement')->assertOk();
})->with([true, false]);

test('news context reads do not use comment allowance and replies share the write limit', function () {
    $this->actingAs(User::factory()->create());
    $article = News::factory()->create();
    $base = '/news/'.$article->getKey();

    for ($i = 0; $i < 6; $i++) {
        $this->getJson($base.'/engagement')->assertOk();
    }
    $this->postJson($base.'/comment', ['content' => 'Informasi yang membantu'])->assertCreated();
    for ($i = 0; $i < 4; $i++) {
        $this->postJson($base.'/comment', ['content' => 'Komentar warga '.$i])->assertCreated();
    }
    $this->postJson('/comments/'.\App\Models\Comment::first()->getKey().'/replies', ['content' => 'Balasan'])
        ->assertStatus(429)->assertHeader('Retry-After');
    $this->getJson($base.'/engagement')->assertOk();
});
