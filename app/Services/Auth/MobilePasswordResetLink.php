<?php

namespace App\Services\Auth;

use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;

class MobilePasswordResetLink
{
    public function destination(?string $requested = null): string
    {
        $configured = config('services.mobile.password_reset_return_url');
        if ($requested === null || $requested === $configured) {
            return $configured;
        }
        if (in_array($requested, ['apakhabarmobileapp:///reset-password', 'apakhabarmobileapp://reset-password'], true)) {
            return $requested;
        }
        $url = parse_url($requested);
        $valid = is_array($url) && ! isset($url['user']) && ! isset($url['pass'])
            && ! isset($url['query']) && ! isset($url['fragment'])
            && ! preg_match('/[\\\\\s\x00-\x1f]/', $requested);
        // Reset tokens may only leave production for an explicitly trusted Expo session.
        // The complete destination is subsequently protected by the email signature.
        if ($valid && in_array($url['scheme'] ?? '', ['exp', 'exps'], true)
            && ! empty($url['host']) && ($url['path'] ?? '') === '/--/reset-password'
            && in_array($requested, config('services.mobile.password_reset_expo_return_urls', []), true)) {
            return $requested;
        }
        if ($valid && app()->environment(['local', 'testing'])) {
            // APP_URL is supplied by start-local.ps1 + compose.lan.yaml on each startup.
            $valid = ($url['host'] ?? '') === parse_url(config('app.url'), PHP_URL_HOST)
                && in_array($url['scheme'] ?? '', ['exp', 'exps', 'http', 'https'], true)
                && in_array($url['path'] ?? '', ['/--/reset-password', '/reset-password'], true);
        } else {
            $valid = false;
        }
        if (! $valid) {
            throw ValidationException::withMessages(['return_url' => 'Tautan kembali ke aplikasi belum diizinkan. Hubungi administrator untuk mengizinkan sesi Expo ini, atau gunakan aplikasi ApaKhabar yang terpasang.']);
        }

        return $requested;
    }

    public function emailUrl(string $token, string $email, string $destination): string
    {
        $path = URL::temporarySignedRoute('mobile.password.reset',
            now()->addMinutes(config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60)),
            ['token' => $token, 'email' => $email, 'return_url' => $destination], absolute: false);

        // Trust configured origin, not an email parameter or a caller-controlled Host header.
        return rtrim(config('app.url'), '/').$path;
    }
}
