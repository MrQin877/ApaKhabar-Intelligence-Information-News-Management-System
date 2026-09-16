<?php

namespace App\Services\Settings;

use App\Models\User;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

class PhoneOtpRateLimiter
{
    public const DAILY_MESSAGE = 'Terlalu banyak permintaan OTP. Silakan coba lagi besok.';

    private const DAILY_LIMIT = 5;

    private const COOLDOWN_SECONDS = 60;

    private function keys(User $user, ?string $phone): array
    {
        $keys = ['phone-otp:user:'.$user->getKey()];

        if ($phone) {
            $keys[] = 'phone-otp:number:'.hash('sha256', $phone);
        }

        return $keys;
    }

    public function status(User $user, ?string $phone): array
    {
        $now = now();
        $retryAt = 0;
        $dailyLimitReached = false;

        foreach ($this->keys($user, $phone) as $key) {
            $retryAt = max($retryAt, (int) Cache::get($key.':cooldown', 0));
            $dailyLimitReached = $dailyLimitReached || (int) Cache::get($key.':'.$now->toDateString(), 0) >= self::DAILY_LIMIT;
        }

        return [
            'retryAt' => $retryAt,
            'dailyLimitReached' => $dailyLimitReached,
            'dailyResetAt' => $now->copy()->startOfDay()->addDay()->timestamp,
        ];
    }

    public function reserve(User $user, string $phone): void
    {
        [$userKey, $phoneKey] = $this->keys($user, $phone);

        try {
            // Both counters must be checked and reserved together, even for simultaneous requests.
            Cache::lock($userKey.':lock', 10)->block(5, function () use ($user, $phone, $userKey, $phoneKey) {
                Cache::lock($phoneKey.':lock', 10)->block(5, function () use ($user, $phone, $userKey, $phoneKey) {
                    $status = $this->status($user, $phone);

                    if ($status['dailyLimitReached']) {
                        throw ValidationException::withMessages(['phone' => self::DAILY_MESSAGE]);
                    }

                    if ($status['retryAt'] > now()->timestamp) {
                        throw ValidationException::withMessages([
                            'phone' => 'Silakan tunggu '.($status['retryAt'] - now()->timestamp).' detik sebelum meminta OTP lagi.',
                        ]);
                    }

                    $now = now();
                    $resetAt = $now->copy()->startOfDay()->addDay();

                    foreach ([$userKey, $phoneKey] as $key) {
                        $dailyKey = $key.':'.$now->toDateString();
                        Cache::put($dailyKey, (int) Cache::get($dailyKey, 0) + 1, $resetAt);
                        Cache::put($key.':cooldown', $now->timestamp + self::COOLDOWN_SECONDS, $now->copy()->addSeconds(self::COOLDOWN_SECONDS));
                    }
                });
            });
        } catch (LockTimeoutException) {
            throw ValidationException::withMessages(['phone' => 'Permintaan OTP sedang diproses. Silakan coba lagi sebentar.']);
        }
    }
}
