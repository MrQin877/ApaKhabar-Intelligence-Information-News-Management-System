<?php

namespace App\Services\Shorts;

use App\Models\ShortVideo;

class ReelCaption
{
    public const INSTAGRAM_MAX = 2200;

    // Keep Facebook within the existing description limit until a verified
    // Graph API Reel-specific limit is available.
    public const FACEBOOK_MAX = 10000;

    public static function format(ShortVideo $video): string
    {
        $title = trim((string) $video->title);
        $description = trim((string) $video->description);

        if ($description === '') {
            return $title;
        }

        if ($title === '' || self::startsWithTitle($description, $title)) {
            return $description;
        }

        return $title."\n\n".$description;
    }

    private static function startsWithTitle(string $description, string $title): bool
    {
        $prefix = mb_substr($description, 0, mb_strlen($title));
        if (mb_strtolower($prefix) !== mb_strtolower($title)) {
            return false;
        }

        $after = mb_substr($description, mb_strlen($title), 1);

        return $after === '' || preg_match('/^[\s\p{P}]$/u', $after) === 1;
    }
}
