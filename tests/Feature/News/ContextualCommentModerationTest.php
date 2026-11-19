<?php

use App\Services\News\CommentModeration;
use Illuminate\Support\Facades\Http;

test('comments publish without external AI checks', function (string $content) {
    Http::preventStrayRequests();
    Http::fake();
    $result = app(CommentModeration::class)->check($content);
    expect($result['status'])->toBe('published')
        ->and($result['ai_flagged'])->toBeNull()
        ->and($result['moderation_categories'])->toBe([])
        ->and($result['moderation_reason'])->toBe('manual_moderation');
    Http::assertNothingSent();
})->with(['thank you for the information', 'fuck you', 'Terima kasih', 'https://example.com']);
