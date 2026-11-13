<?php

use App\Models\Comment;
use App\Models\News;
use App\Models\ShortVideo;
use App\Models\ShortVideoComment;
use App\Models\User;
use App\Models\UserRole;
use App\Services\News\CommentModeration;
use App\Services\News\InteractionService;
use App\Services\Shorts\ShortCommentService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['engagement.openai_key' => 'test-key']);
    Http::preventStrayRequests();
});

test('contextual violations are hidden on news and video roots and replies without duplicate history', function (string $category) {
    $classification = appropriateCommentClassification();
    $flags = json_decode($classification['choices'][0]['message']['content'], true);
    $flags[$category] = true;
    $classification['choices'][0]['message']['content'] = json_encode($flags);
    Http::fake([
        'api.openai.com/v1/moderations' => Http::response(['results' => [[
            'flagged' => false, 'categories' => ['harassment' => false], 'category_scores' => ['harassment' => 0.02],
        ]]]),
        'api.openai.com/v1/chat/completions' => Http::response($classification),
    ]);
    $user = User::factory()->create();
    $admin = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $news = News::factory()->create();
    $parent = Comment::create(['newsID' => $news->getKey(), 'userID' => $user->getKey(), 'content' => 'Parent', 'status' => 'published']);
    $video = ShortVideo::create([
        'created_by' => $user->getKey(), 'title' => 'Update', 'video_url' => 'https://example.com/video.mp4',
        'thumbnail_url' => 'https://example.com/thumbnail.jpg',
        'metadata' => ['duration' => 20],
        'video_public_id' => 'test', 'status' => 'published', 'published_at' => now(),
    ]);
    $videoParent = ShortVideoComment::create(['short_video_id' => $video->id, 'user_id' => $user->getKey(), 'content' => 'Parent', 'status' => 'published', 'submission_hash' => hash('sha256', 'parent')]);
    $newsService = app(InteractionService::class);
    $videoService = app(ShortCommentService::class);
    $comments = [
        $newsService->addComment($user->getKey(), $news->getKey(), 'Root violation'),
        $newsService->addReply($user->getKey(), $parent->getKey(), 'Reply violation'),
        $videoService->add($video, $user->getKey(), 'Root violation'),
        $videoService->add($video, $user->getKey(), 'Reply violation', $videoParent),
    ];
    foreach ($comments as $comment) {
        expect($comment->status)->toBe('pending_review')->and($comment->ai_flagged)->toBeTrue()
            ->and($comment->moderation_categories[$category])->toBeTrue();
    }
    expect(DB::table('comment_flags')->count())->toBe(0)
        ->and(DB::table('short_video_comment_flags')->count())->toBe(0);
    expect(fn () => $newsService->addComment($user->getKey(), $news->getKey(), 'Root violation'))->toThrow(ValidationException::class);
    expect(fn () => $videoService->add($video, $user->getKey(), 'Root violation'))->toThrow(ValidationException::class);
    expect(DB::table('comment_moderation_history')->count())->toBe(2)
        ->and(DB::table('short_video_comment_history')->count())->toBe(2);
    $this->getJson('/news/'.$news->getKey())->assertOk()->assertJsonPath('data.comments', 1);
    $this->getJson('/shorts/'.$video->id.'/comments')->assertJsonPath('count', 1);
    foreach (['news', 'shorts'] as $type) {
        $this->actingAs($admin)->get('/admin/comments?source=ai&content_type='.$type)
            ->assertInertia(fn (Assert $page) => $page->has('comments.data', 2)->where('comments.data.0.categories.'.$category, true));
        $comment = $type === 'news' ? $comments[0] : $comments[2];
        $this->postJson('/admin/comments/'.$comment->getKey().'/decision', [
            'content_type' => $type, 'action' => 'allow', 'expected_revision' => 0,
        ])->assertOk();
        expect($comment->fresh()->status)->toBe('published')->and($comment->fresh()->moderation_categories[$category])->toBeTrue();
        $this->postJson('/admin/comments/'.$comment->getKey().'/decision', [
            'content_type' => $type, 'action' => 'hide', 'expected_revision' => 1,
        ])->assertOk();
        expect($comment->fresh()->status)->toBe('hidden');
    }
})->with(['profanity', 'harassment', 'threat', 'hate', 'other_harmful']);

test('contextual classifier failures never publish a comment cleared by moderation', function (string $failure) {
    Http::fake([
        'api.openai.com/v1/moderations' => Http::response(['results' => [['flagged' => false, 'categories' => ['harassment' => false]]]]),
        'api.openai.com/v1/chat/completions' => function () use ($failure) {
            if ($failure === 'timeout') {
                throw new ConnectionException('timeout');
            }
            $body = appropriateCommentClassification();
            if ($failure === 'truncated') {
                $body['choices'][0]['finish_reason'] = 'length';
            } elseif ($failure === 'refusal') {
                $body['choices'][0]['message']['refusal'] = 'Cannot classify';
            } elseif ($failure === 'malformed') {
                $body['choices'][0]['message']['content'] = '{';
            } elseif ($failure === 'missing') {
                $body['choices'][0]['message']['content'] = '{}';
            } elseif ($failure === 'nonboolean') {
                $body['choices'][0]['message']['content'] = '{"profanity":"false","harassment":false,"threat":false,"hate":false,"other_harmful":false}';
            }

            return Http::response($body, $failure === 'server' ? 503 : 200);
        },
    ]);
    $result = app(CommentModeration::class)->check('Terima kasih');
    expect($result['status'])->toBe('pending_review')->and($result['ai_flagged'])->toBeNull()
        ->and($result['moderation_reason'])->toBe('moderation_unavailable');
})->with(['timeout', 'server', 'truncated', 'refusal', 'malformed', 'missing', 'nonboolean']);

test('moderation flags cannot be overridden by a contextual classification', function () {
    Http::fake(['api.openai.com/v1/moderations' => Http::response(['results' => [['flagged' => true, 'categories' => ['violence' => true]]]])]);
    expect(app(CommentModeration::class)->check('Threat')['ai_flagged'])->toBeTrue();
    Http::assertSentCount(1);
});

test('multilingual and quotation fixtures reach the classifier unchanged and follow its decision', function () {
    // Contract test with simulated API decisions; semantic accuracy is measured by
    // scripts/probe-comment-moderation.php against the real models.
    $samples = json_decode(file_get_contents(base_path('tests/Fixtures/comment-moderation.json')), true);
    $decisions = Http::sequence();
    foreach ($samples as $sample) {
        $body = appropriateCommentClassification();
        $flags = json_decode($body['choices'][0]['message']['content'], true);
        if ($sample['category']) {
            $flags[$sample['category']] = true;
        }
        $body['choices'][0]['message']['content'] = json_encode($flags);
        $decisions->push($body);
    }
    Http::fake([
        'api.openai.com/v1/moderations' => Http::response(['results' => [['flagged' => false, 'categories' => ['harassment' => false]]]]),
        'api.openai.com/v1/chat/completions' => $decisions,
    ]);
    foreach ($samples as $sample) {
        $result = app(CommentModeration::class)->check($sample['text']);
        expect($result['status'])->toBe($sample['category'] ? 'pending_review' : 'published');
        Http::assertSent(fn ($request) => $request->url() === 'https://api.openai.com/v1/chat/completions'
            && $request['messages'][1]['content'] === $sample['text']
            && $request['response_format']['json_schema']['strict'] === true);
    }
});
