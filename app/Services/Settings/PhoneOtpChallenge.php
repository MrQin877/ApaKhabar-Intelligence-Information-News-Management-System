<?php

namespace App\Services\Settings;

use Illuminate\Support\Facades\Hash;

/** Shared validation for cached phone-change and password-recovery challenges. */
class PhoneOtpChallenge
{
    public static function rules(): array
    {
        return ['required', 'string', 'regex:/^[0-9]{6}$/'];
    }

    public static function issue(string $otp): array
    {
        return ['otp_hash' => Hash::make($otp), 'attempts' => 0, 'expires_at' => now()->addMinutes(10)->timestamp];
    }

    /** Return an error and increment failed attempts; callers persist under their own lock. */
    public static function check(array &$pending, string $otp): ?array
    {
        if (!isset($pending['otp_hash']) || $pending['expires_at'] <= now()->timestamp) {
            return ['message' => 'Kod OTP telah digunakan atau tamat tempoh. Sila minta OTP baharu.', 'code' => 422];
        }
        if ($pending['attempts'] >= 5) return ['message' => 'Terlalu banyak kod yang salah. Sila minta OTP baharu.', 'code' => 429];
        if (!Hash::check($otp, $pending['otp_hash'])) {
            $pending['attempts']++;
            return ['message' => 'Kod OTP tidak sah.', 'code' => 422];
        }
        return null;
    }
}
