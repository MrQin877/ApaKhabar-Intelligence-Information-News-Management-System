<?php

namespace App\Support;

use Illuminate\Support\Str;

class ArticleText
{
    public static function plain(?string $content): string
    {
        $content = preg_replace('/<(script|style)\b[^>]*>.*?<\/\1>/is', '', $content ?? '');
        $content = preg_replace('/<\s*br\b[^>]*>|<\/\s*(?:p|div|li|h[1-6]|blockquote)\s*>/i', "\n\n", $content);
        $text = html_entity_decode(strip_tags($content), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/[^\S\n]+/u', ' ', str_replace(["\r\n", "\r", "\u{00a0}"], ["\n", "\n", ' '], $text));

        return trim(preg_replace('/ *\n(?: *\n)+ */u', "\n\n", $text));
    }

    public static function preview(?string $content): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', self::plain($content)));
        foreach (preg_split('/(?<=[.!?。！？])\s+/u', $text) as $sentence) {
            if (preg_match('/[\p{L}\p{N}]/u', $sentence)) {
                return Str::limit($sentence, 157, '...');
            }
        }

        return '';
    }

    public static function post(string $title, ?string $content): string
    {
        return trim(self::plain($title)."\n\n".self::plain($content));
    }
}
