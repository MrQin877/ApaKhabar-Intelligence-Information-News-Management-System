<?php

use App\Models\Comment;
use App\Models\News;
use App\Models\ShortVideo;
use App\Models\ShortVideoComment;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

function engagedShort(): ShortVideo
{
    $owner = User::factory()->create();

    return ShortVideo::create([
        'created_by' => $owner->getKey(), 'title' => 'Video Pendek Desa', 'description' => 'Kegiatan warga',
        'video_url' => 'https://res.cloudinary.com/demo/video/upload/short.mp4', 'video_public_id' => 'short',
        'thumbnail_url' => 'https://res.cloudinary.com/demo/video/upload/short.jpg', 'metadata' => ['duration' => 20],
        'status' => 'published', 'published_at' => now(),
    ]);
}

function shortActor(string $role = 'villager'): User
{
    return User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => $role])->getKey()]);
}

function agedShortCommentChallenge($test, ShortVideo $video): string
{
    $test->withCredentials();
    $token = $test->getJson('/shorts/'.$video->id.'/engagement')->assertOk()->json('challenge');
    $test->withCookie(config('session.cookie'), app('session')->getId());
    $claim = json_decode(Crypt::decryptString($token), true);
    $claim['time'] -= 4;

    return Crypt::encryptString(json_encode($claim));
}

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Http::preventStrayRequests();
});

test('guest Shorts comments require an aged challenge and do not enter News data', function () {
    $video = engagedShort();
    $url = '/shorts/'.$video->id.'/comments';
    $this->postJson($url, ['content' => 'Komentar warga'])->assertUnprocessable();
    $this->postJson($url, ['content' => 'Komentar warga', 'challenge' => agedShortCommentChallenge($this, $video), 'website' => 'spam'])->assertUnprocessable();
    $this->postJson($url, ['content' => 'Komentar warga', 'challenge' => agedShortCommentChallenge($this, $video)])
        ->assertCreated()->assertJsonPath('status', 'published')->assertJsonPath('comment.content', 'Komentar warga');
    $this->postJson($url, ['content' => 'Komentar warga', 'challenge' => agedShortCommentChallenge($this, $video)])->assertUnprocessable();
    expect(ShortVideoComment::count())->toBe(1)->and(Comment::count())->toBe(0);
    $this->getJson($url)->assertJsonPath('count', 1)->assertJsonPath('comments.data.0.replies_count', 0);
});

test('Shorts publish without matching words or calling external services', function (string $content) {
    $video = engagedShort();
    $this->actingAs(shortActor())->postJson('/shorts/'.$video->id.'/comments', ['content' => $content])
        ->assertCreated()->assertJsonPath('status', 'published')->assertJsonPath('comment.content', $content);
    $this->getJson('/shorts/'.$video->id.'/comments')->assertOk()->assertJsonPath('count', 1);
    Http::assertNothingSent();
})->with(['Info diskon warga: https://example.com', 'Damn, jalan ini rusak lagi.']);

test('guest identity and WIB quota are shared by News, Shorts, and replies', function () {
    $video = engagedShort();
    $news = News::factory()->create();
    $shortUrl = '/shorts/'.$video->id.'/comments';
    $first = $this->postJson($shortUrl, ['content' => 'Komentar video pertama', 'challenge' => agedShortCommentChallenge($this, $video)])
        ->assertCreated()->assertJsonPath('remaining_quota', 2);
    $guestCookie = collect($first->headers->getCookies())->first(fn ($cookie) => $cookie->getName() === 'apakhabar_guest');
    expect($guestCookie)->not->toBeNull();
    $this->withUnencryptedCookie('apakhabar_guest', $guestCookie->getValue());
    $root = $first->json('comment.id');
    $this->postJson($shortUrl.'/'.$root.'/replies', ['content' => 'Balasan video kedua', 'challenge' => agedShortCommentChallenge($this, $video)])
        ->assertCreated()->assertJsonPath('remaining_quota', 1);
    $token = $this->getJson('/news/'.$news->getKey().'/engagement')->assertOk()->json('token');
    $claim = json_decode(Crypt::decryptString($token), true);
    $claim['time'] -= 4;
    $this->postJson('/news/'.$news->getKey().'/comment', ['content' => 'Komentar berita ketiga', 'challenge' => Crypt::encryptString(json_encode($claim))])
        ->assertCreated()->assertJsonPath('remaining_quota', 0);
    expect(Comment::first()->guest_name)->toBe(ShortVideoComment::first()->guest_name)
        ->and(ShortVideoComment::count())->toBe(2);
    $this->postJson($shortUrl, ['content' => 'Komentar keempat', 'challenge' => agedShortCommentChallenge($this, $video)])
        ->assertUnprocessable()->assertJsonPath('errors.quota.0', 'Kuota 3 komentar hari ini habis. Coba lagi besok atau masuk untuk lanjut berkomentar.');
    expect(DB::table('guest_comment_days')->first()->comment_count)->toBe(3);
    $this->travelTo(now('Asia/Jakarta')->startOfDay()->addDay());
    $this->postJson($shortUrl, ['content' => 'Komentar hari baru', 'challenge' => agedShortCommentChallenge($this, $video)])
        ->assertCreated()->assertJsonPath('remaining_quota', 2);
    $token = $this->getJson('/news/'.$news->getKey().'/engagement')->assertOk()->json('token');
    $claim = json_decode(Crypt::decryptString($token), true);
    $claim['time'] -= 4;
    $this->postJson('/comments/'.Comment::first()->getKey().'/replies', ['content' => 'Balasan berita hari baru', 'challenge' => Crypt::encryptString(json_encode($claim))])
        ->assertCreated()->assertJsonPath('remaining_quota', 1);
    expect(Comment::latest('commentID')->first()->guest_name)->toBe(ShortVideoComment::first()->guest_name);
});

test('published comments consume guest quota while authenticated comments remain exempt', function () {
    $video = engagedShort();
    $url = '/shorts/'.$video->id.'/comments';
    $first = $this->postJson($url, ['content' => 'Komentar ditinjau satu', 'challenge' => agedShortCommentChallenge($this, $video)])
        ->assertCreated()->assertJsonPath('status', 'published')->assertJsonPath('remaining_quota', 2);
    $cookie = collect($first->headers->getCookies())->first(fn ($item) => $item->getName() === 'apakhabar_guest');
    $this->withUnencryptedCookie('apakhabar_guest', $cookie->getValue());
    foreach (['Komentar ditinjau dua', 'Komentar ditinjau tiga'] as $index => $content) {
        $this->postJson($url, ['content' => $content, 'challenge' => agedShortCommentChallenge($this, $video)])
            ->assertCreated()->assertJsonPath('remaining_quota', 1 - $index);
    }
    $this->postJson($url, ['content' => 'Komentar ditinjau empat', 'challenge' => agedShortCommentChallenge($this, $video)])
        ->assertUnprocessable()->assertJsonPath('errors.quota.0', 'Kuota 3 komentar hari ini habis. Coba lagi besok atau masuk untuk lanjut berkomentar.');
    expect(ShortVideoComment::where('status', 'published')->count())->toBe(3);
    $this->actingAs(shortActor())->postJson($url, ['content' => 'Komentar pengguna masuk'])->assertCreated();
});

test('short comments publish without OpenAI and do not enter the pending queue', function () {
    $video = engagedShort();
    $this->actingAs(shortActor())->postJson('/shorts/'.$video->id.'/comments', [
        'content' => 'Komentar saat layanan mati',
    ])->assertCreated()->assertJsonPath('status', 'published');
    expect(ShortVideoComment::first()->ai_flagged)->toBeNull();
    $this->actingAs(shortActor('moderator'))->get('/admin/comments?content_type=shorts')
        ->assertInertia(fn (Assert $page) => $page->where('counts.pending', 0));
});

test('Shorts likes and one-level reply pagination use separate persistent records', function () {
    $video = engagedShort();
    $user = shortActor();
    $this->actingAs($user);
    $url = '/shorts/'.$video->id;
    $this->postJson($url.'/like')->assertJsonPath('likes_count', 1)->assertJsonPath('liked', true);
    $this->get($url)->assertInertia(fn (Assert $page) => $page->where('short.likes_count', 1)->where('likedByUser', true));
    $this->postJson($url.'/like')->assertJsonPath('likes_count', 0)->assertJsonPath('liked', false);
    $root = $this->postJson($url.'/comments', ['content' => 'Komentar pertama'])->assertCreated()->json('comment.id');
    $reply = $this->postJson($url.'/comments/'.$root.'/replies', ['content' => 'Balasan pertama'])->assertCreated()->json('comment.id');
    $this->postJson($url.'/comments/'.$reply.'/replies', ['content' => 'Balasan kedua'])->assertCreated()->assertJsonPath('comment.recipient', $user->name);
    $this->postJson($url.'/comments/'.$reply.'/replies', ['content' => 'Balasan ketiga'])->assertCreated();
    $this->postJson($url.'/comments/'.$root.'/replies', ['content' => 'Balasan keempat'])->assertCreated();
    expect(ShortVideoComment::find($reply)->root_id)->toBe((int) $root);
    $this->getJson($url.'/comments')->assertJsonPath('count', 5)->assertJsonPath('comments.data.0.replies_count', 4);
    $this->getJson($url.'/comments/'.$root.'/replies')->assertJsonCount(3, 'data')->assertJsonPath('last_page', 2);
    $this->getJson($url.'/comments/'.$root.'/replies?page=2')->assertJsonCount(1, 'data');
    $this->postJson($url.'/comments/'.$root.'/like')->assertJsonPath('likes_count', 1)->assertJsonPath('liked', true);
    $this->postJson($url.'/comments/'.$root.'/like')->assertJsonPath('likes_count', 0)->assertJsonPath('liked', false);
    expect(DB::table('short_video_comment_likes')->count())->toBe(0);
});

test('user report and moderator flag enter the same admin queue with distinct content identification', function () {
    $video = engagedShort();
    $villager = shortActor();
    $moderator = shortActor('moderator');
    $root = ShortVideoComment::create(['short_video_id' => $video->id, 'user_id' => $villager->getKey(), 'content' => 'Periksa isi', 'status' => 'published', 'submission_hash' => hash('sha256', 'first')]);
    $url = '/shorts/'.$video->id.'/comments/'.$root->id;
    $this->actingAs($villager)->postJson($url.'/report', ['category' => 'Spam'])->assertOk();
    $this->postJson($url.'/report', ['category' => 'Spam'])->assertOk();
    expect(DB::table('short_video_comment_reports')->count())->toBe(1);
    $this->postJson($url.'/flag', ['category' => 'spam'])->assertForbidden();
    $this->actingAs($moderator)->postJson($url.'/report', ['category' => 'Spam'])->assertForbidden();
    $this->postJson($url.'/flag', ['category' => 'spam', 'explanation' => 'Tinjau'])->assertOk();
    $this->postJson($url.'/flag', ['category' => 'spam'])->assertOk();
    expect(DB::table('short_video_comment_flags')->count())->toBe(1);
    $this->get('/admin/comments?content_type=shorts')->assertInertia(fn (Assert $page) => $page->where('comments.data.0.content_type', 'shorts')->where('counts.pending', 1)->where('comments.data.0.news.title', $video->title));
    $this->postJson('/admin/comments/'.$root->id.'/decision', ['content_type' => 'shorts', 'action' => 'hide', 'expected_revision' => 0])->assertOk();
    expect($root->fresh()->status)->toBe('hidden');
    $this->getJson('/shorts/'.$video->id.'/comments')->assertJsonPath('count', 0);
    $this->get('/admin/comments?content_type=shorts&tab=history')->assertInertia(fn (Assert $page) => $page->where('comments.data.0.status', 'hidden')->where('comments.data.0.history.0.to_status', 'hidden'));
    $this->postJson('/admin/comments/'.$root->id.'/decision', ['content_type' => 'shorts', 'action' => 'allow', 'expected_revision' => 1])->assertOk();
    expect($root->fresh()->status)->toBe('published')->and(DB::table('short_video_comment_history')->where('comment_id', $root->id)->count())->toBe(2);
});

test('mobile villager report uses the video API and preserves its reason in moderation', function () {
    $video = engagedShort();
    $author = shortActor();
    $reporter = shortActor();
    $comment = ShortVideoComment::create(['short_video_id' => $video->id,
        'user_id' => $author->getKey(), 'content' => 'Komentar video', 'status' => 'published',
        'submission_hash' => hash('sha256', 'mobile-report')]);
    $url = '/api/shorts/'.$video->id.'/comments/'.$comment->id.'/report';
    $this->postJson($url, ['reason' => 'Komentar berisi penghinaan.'])->assertUnauthorized();
    $headers = ['Authorization' => 'Bearer '.$reporter->createToken('test')->plainTextToken];
    $this->postJson($url, ['reason' => 'Komentar berisi penghinaan.'], $headers)->assertOk();
    $this->assertDatabaseHas('short_video_comment_reports', ['comment_id' => $comment->id,
        'user_id' => $reporter->getKey(), 'category' => 'Lainnya', 'explanation' => 'Komentar berisi penghinaan.']);
    expect(DB::table('comment_reports')->count())->toBe(0);
    $this->actingAs(shortActor('admin'))->get('/admin/comments?content_type=shorts&source=reported')
        ->assertInertia(fn (Assert $page) => $page->where('counts.reported', 1)
            ->where('comments.data.0.content_type', 'shorts')
            ->where('comments.data.0.reports.0.reporter_name', $reporter->name)
            ->where('comments.data.0.reports.0.explanation', 'Komentar berisi penghinaan.')
            ->missing('comments.data.0.ai_flagged')->missing('counts.ai'));
});

test('admin flag temporarily hides a video comment and allow resolves the flag', function () {
    $video = engagedShort();
    $reader = shortActor();
    $admin = shortActor('admin');
    $comment = ShortVideoComment::create([
        'short_video_id' => $video->id, 'user_id' => $reader->getKey(),
        'content' => 'Komentar video terlihat', 'status' => 'published',
        'submission_hash' => hash('sha256', 'video-flag'),
    ]);
    $flag = '/shorts/'.$video->id.'/comments/'.$comment->id.'/flag';
    $this->actingAs($reader)->postJson($flag, ['category' => 'spam'])->assertForbidden();
    $this->actingAs($admin)->postJson($flag, ['category' => 'spam', 'explanation' => 'Periksa'])->assertOk();
    $this->postJson($flag, ['category' => 'spam'])->assertOk();
    expect($comment->fresh()->status)->toBe('pending_review')
        ->and(DB::table('short_video_comment_flags')->count())->toBe(1);
    $this->getJson('/shorts/'.$video->id.'/comments')->assertJsonPath('count', 0);
    $this->get('/admin/comments?content_type=shorts')->assertInertia(fn (Assert $page) => $page
        ->has('comments.data', 1)->where('counts.pending', 1)
        ->where('comments.data.0.flags.0.moderator_name', $admin->name));
    $this->postJson('/admin/comments/'.$comment->id.'/decision', [
        'content_type' => 'shorts', 'action' => 'allow', 'reason' => 'Aman', 'expected_revision' => 0,
    ])->assertOk();
    expect($comment->fresh()->status)->toBe('published')
        ->and(DB::table('short_video_comment_flags')->whereNull('resolved_at')->count())->toBe(0);
    $this->assertDatabaseHas('short_video_comment_history', [
        'comment_id' => $comment->id, 'moderator_id' => $admin->getKey(),
        'action' => 'allow', 'from_status' => 'pending_review', 'to_status' => 'published',
    ]);
});
