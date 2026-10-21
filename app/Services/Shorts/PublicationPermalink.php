<?php

namespace App\Services\Shorts;

class PublicationPermalink
{
    public static function normalize(string $platform, mixed $value): ?string
    {
        if (! is_string($value) || $value === '' || preg_match('/[\x00-\x20\\\\]/', $value)) {
            return null;
        }
        // Meta may return an origin-relative Video.permalink_url. Preserve its exact path.
        if ($platform === 'facebook' && str_starts_with($value, '/') && ! str_starts_with($value, '//')) {
            $value = 'https://www.facebook.com'.$value;
        }
        $url = parse_url($value);
        $domain = match ($platform) {
            'facebook' => 'facebook.com', 'instagram' => 'instagram.com', default => null
        };
        $host = strtolower($url['host'] ?? '');
        if (! $domain || ($url['scheme'] ?? '') !== 'https' || isset($url['user']) || isset($url['pass']) || (isset($url['port']) && $url['port'] !== 443) || ($host !== $domain && ! str_ends_with($host, '.'.$domain))) {
            return null;
        }

        return $value;
    }
}
