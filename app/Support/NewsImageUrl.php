<?php

namespace App\Support;

class NewsImageUrl
{
    /** Use the browser's origin for local news images without changing stored or API URLs. */
    public static function forWeb(?string $url): ?string
    {
        $parts = $url ? parse_url($url) : false;
        if ($parts === false) {
            return $url;
        }

        $host = strtolower($parts['host'] ?? '');
        $path = $parts['path'] ?? '';
        $appHost = strtolower(parse_url(config('app.url'), PHP_URL_HOST) ?? '');
        $localHost = in_array($host, ['', $appHost, 'localhost', '127.0.0.1', '[::1]', '0.0.0.0'], true)
            || (filter_var($host, FILTER_VALIDATE_IP)
                && ! filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE));

        if (! $localHost || ! str_starts_with($path, '/storage/news-images/')) {
            return $url;
        }

        return $path
            .(isset($parts['query']) ? '?'.$parts['query'] : '')
            .(isset($parts['fragment']) ? '#'.$parts['fragment'] : '');
    }

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
