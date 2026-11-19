<?php

namespace App\Services\Auth;

use Illuminate\Validation\ValidationException;

class MobileVerificationLink
{
    public function destination(?string $requested = null): string
    {
        $configured = config('services.mobile.verification_return_url');
        if ($requested === null || $requested === $configured) {
            return $configured;
        }
        if (in_array($requested, ['apakhabarmobileapp:///verify-email', 'apakhabarmobileapp://verify-email'], true)) {
            return $requested;
        }
        $url = parse_url($requested);
        // Only Expo Go navigation is accepted; no tokens are passed to this URL.
        // The destination is protected by the verification email's signature.
        if (is_array($url)
            && in_array($url['scheme'] ?? '', ['exp', 'exps'], true)
            && ! empty($url['host'])
            && ($url['path'] ?? '') === '/--/verify-email'
            && ! isset($url['user']) && ! isset($url['pass'])
            && ! isset($url['query']) && ! isset($url['fragment'])
            && ! preg_match('/[\\\\\s\x00-\x1f]/', $requested)) {
            return $requested;
        }

        throw ValidationException::withMessages(['return_url' => 'Pautan kembali ke aplikasi tidak sah.']);
    }
}
