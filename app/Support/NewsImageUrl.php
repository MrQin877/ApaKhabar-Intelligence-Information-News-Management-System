<?php

namespace App\Support;

class NewsImageUrl
{
    public static function resolve(?string $url): ?string
    {
        if (! $url) {
            return $url;
        }

        $parts = parse_url($url);
        if ($parts === false) {
            return $url;
        }

        $host = strtolower($parts['host'] ?? '');
        $path = $parts['path'] ?? '';
        if (! in_array($host, ['', 'localhost', '127.0.0.1', '[::1]', '0.0.0.0'], true)
            || ! str_starts_with('/'.ltrim($path, '/'), '/storage/')) {
            return $url;
        }

        return rtrim(config('app.url'), '/').'/'.ltrim($path, '/')
            .(isset($parts['query']) ? '?'.$parts['query'] : '')
            .(isset($parts['fragment']) ? '#'.$parts['fragment'] : '');
    }
}
