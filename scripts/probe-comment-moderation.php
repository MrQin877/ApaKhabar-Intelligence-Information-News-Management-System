<?php

use App\Services\News\CommentModeration;
use Dotenv\Dotenv;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Http;

// Opt-in live evaluation: sends only the synthetic fixture comments to OpenAI.
// Does not read or write application records. Run from the repository root.
require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$options = getopt('', ['env-file:', 'moderation-only']);
if (isset($options['env-file'])) {
    $values = Dotenv::parse(file_get_contents($options['env-file']));
    config(['engagement.openai_key' => $values['OPENAI_API_KEY'] ?? null]);
    if (! empty($values['OPENAI_COMMENT_CLASSIFICATION_MODEL'])) {
        config(['engagement.classification_model' => $values['OPENAI_COMMENT_CLASSIFICATION_MODEL']]);
    }
}
if (! config('engagement.openai_key')) {
    fwrite(STDERR, "No OpenAI key configured. Set OPENAI_API_KEY or pass --env-file=deployment/laravel.env.\n");
    exit(2);
}
$assessment = null;
$statuses = [];
Http::globalResponseMiddleware(function ($response) use (&$assessment, &$statuses) {
    $statuses[] = $response->getStatusCode();
    $body = json_decode((string) $response->getBody(), true);
    if (isset($body['results'][0]['category_scores'])) {
        $assessment = $body['results'][0];
    }

    return $response;
});
$failed = 0;
foreach (json_decode(file_get_contents(__DIR__.'/../tests/Fixtures/comment-moderation.json'), true, 512, JSON_THROW_ON_ERROR) as $sample) {
    $assessment = null;
    $statuses = [];
    if (isset($options['moderation-only'])) {
        Http::withToken(config('engagement.openai_key'))->connectTimeout(3)->timeout(15)
            ->post('https://api.openai.com/v1/moderations', ['model' => 'omni-moderation-latest', 'input' => $sample['text']])->throw();
        echo json_encode(['text' => $sample['text'], 'expected_category' => $sample['category'], 'moderation' => $assessment], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES).PHP_EOL;

        continue;
    }
    $result = app(CommentModeration::class)->check($sample['text']);
    $expectedFlag = $sample['category'] !== null;
    $passed = $result['ai_flagged'] === $expectedFlag;
    $failed += $passed ? 0 : 1;
    echo json_encode([
        'text' => $sample['text'], 'expected_category' => $sample['category'], 'passed' => $passed,
        'moderation' => $assessment, 'upstream_statuses' => $statuses, 'decision' => $result,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES).PHP_EOL;
    if ($result['ai_flagged'] === null) {
        fwrite(STDERR, "OpenAI unavailable or returned an invalid classification; stopping live probe.\n");
        exit(2);
    }
}
exit($failed ? 1 : 0);
