<?php

namespace App\Services\News;

use Illuminate\Support\Facades\Http;

class CommentModeration
{
    public function check(string $content): array
    {
        $result = ['status' => 'pending_review', 'ai_flagged' => null, 'moderation_categories' => [], 'moderation_reason' => 'moderation_unavailable'];
        // Links are held for a human: the moderation endpoint is not a spam detector.
        $suspicious = preg_match('~https?://|www\.|[a-z0-9-]+\.(com|net|org|id)\b~iu', $content)
            || preg_match('/\b(promo|discount|diskon|whatsapp|telegram|judi|slot gacor)\b/iu', $content);
        if (! config('engagement.openai_key')) {
            return $result;
        }
        try {
            $response = Http::withToken(config('engagement.openai_key'))
                ->connectTimeout(3)->timeout(config('engagement.moderation_timeout'))
                ->post('https://api.openai.com/v1/moderations', [
                    'model' => 'omni-moderation-latest', 'input' => $content,
                ])->throw()->json();
            $response = $response['results'][0] ?? null;
            if (! is_array($response) || ! is_bool($response['flagged'] ?? null)
                || ! is_array($response['categories'] ?? null) || empty($response['categories'])
                || count(array_filter($response['categories'], 'is_bool')) !== count($response['categories'])) {
                return $result;
            }
            $flagged = $response['flagged'] || in_array(true, $response['categories'], true);

            return [
                'status' => ($flagged || $suspicious) ? 'pending_review' : 'published',
                'ai_flagged' => $flagged,
                'moderation_categories' => $response['categories'],
                'moderation_reason' => $flagged ? 'ai_flagged' : ($suspicious ? 'suspicious_promotion_or_link' : 'checks_passed'),
            ];
        } catch (\Throwable $e) {
            // Never log submitted text, the API key, or an upstream response body.
            return $result;
        }
    }
}
