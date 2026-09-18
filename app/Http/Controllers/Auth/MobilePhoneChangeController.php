<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Phone;
use App\Models\User;
use App\Notifications\OtpNotification;
use App\Services\Settings\PhoneOtpRateLimiter;
use App\Services\SmsService;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use App\Services\Settings\PhoneOtpChallenge;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MobilePhoneChangeController extends Controller
{
    public function __construct(private PhoneOtpRateLimiter $limiter) {}

    private function key(User $user): string { return 'mobile-phone-change:'.$user->getKey(); }

    private function pending(User $user, string $challenge): array
    {
        $pending = Cache::get($this->key($user));
        abort_unless($pending && hash_equals($pending['challenge'], $challenge), 410, 'Permintaan telah tamat tempoh. Sila masukkan nombor baharu semula.');

        return $pending;
    }

    private function payload(User $user, array $pending): array
    {
        $limits = $this->limiter->status($user, $pending['phone']);
        return [
            'challenge' => $pending['challenge'], 'phone' => $pending['phone'],
            'phone_verified_at' => $pending['verified_at'] ?? null,
            'otp_pending' => !isset($pending['verified_at']) && $pending['expires_at'] > now()->timestamp,
            'retry_after' => max(0, $limits['retryAt'] - now()->timestamp),
            'daily_limit_reached' => $limits['dailyLimitReached'],
            'daily_reset_after' => max(0, $limits['dailyResetAt'] - now()->timestamp),
        ];
    }

    private function locked(User $user, callable $callback)
    {
        try {
            return Cache::lock($this->key($user).':lock', 30)->block(5, $callback);
        } catch (LockTimeoutException) {
            return response()->json(['message' => 'Permintaan sedang diproses. Sila cuba lagi sebentar.'], 409);
        }
    }

    public function status(Request $request)
    {
        $data = $request->validate(['challenge' => ['required', 'uuid']]);
        return response()->json($this->payload($request->user(), $this->pending($request->user(), $data['challenge'])))
            ->header('Cache-Control', 'no-store');
    }

    public function send(Request $request, SmsService $sms)
    {
        $data = $request->validate([
            'phone' => ['required_without:challenge', 'nullable', 'string', 'regex:/^\+(60|62)[1-9]\d{6,12}$/'],
            'challenge' => ['nullable', 'uuid'],
        ]);
        $user = $request->user();
        return $this->locked($user, function () use ($user, $data, $sms) {
            $user->load('phoneRecord');
            $pending = !empty($data['challenge']) ? $this->pending($user, $data['challenge']) : [
                'challenge' => (string) Str::uuid(), 'phone' => $data['phone'],
                'original_phone' => $user->phone, 'expires_at' => 0,
            ];
            if (isset($pending['verified_at'])) return response()->json(['status' => 'already-verified', ...$this->payload($user, $pending)]);
            if ($pending['phone'] === $user->phone) {
                return response()->json(['message' => 'Sila masukkan nombor telefon yang baharu.'], 422);
            }
            if (Phone::whereKey($pending['phone'])->whereNotNull('phone_verified_at')->exists()) {
                return response()->json(['message' => 'Nombor telefon ini telah disahkan oleh akaun lain.'], 422);
            }
            if ($pending['original_phone'] !== $user->phone) {
                return response()->json(['message' => 'Nombor semasa telah berubah. Sila mulakan semula.'], 409);
            }
            try {
                $this->limiter->reserve($user, $pending['phone']);
            } catch (ValidationException $e) {
                $payload = $this->payload($user, $pending);
                return response()->json(['message' => $e->errors()['phone'][0], ...$payload], 429)
                    ->header('Retry-After', (string) ($payload['daily_limit_reached'] ? $payload['daily_reset_after'] : max(1, $payload['retry_after'])));
            }
            $otp = (string) random_int(100000, 999999);
            // Reuse the OTP message without changing the user's saved phone relation.
            $recipient = clone $user;
            $recipient->setRelation('phoneRecord', new Phone(['phone' => $pending['phone']]));
            $message = (new OtpNotification($otp))->toBulk360($recipient);
            if (!$sms->sendMobileOtp($message['to'], $message['message'])) {
                return response()->json(['message' => 'Gagal menghantar OTP. Sila cuba lagi selepas tempoh menunggu.', ...$this->payload($user, $pending)], 503);
            }
            $pending = array_replace($pending, PhoneOtpChallenge::issue($otp));
            Cache::put($this->key($user), $pending, now()->addDays(7));
            return response()->json(['status' => 'otp-sent', ...$this->payload($user, $pending)]);
        });
    }

    public function verify(Request $request)
    {
        $data = $request->validate(['challenge' => ['required', 'uuid'], 'otp' => PhoneOtpChallenge::rules()]);
        $user = $request->user();
        return $this->locked($user, function () use ($user, $data) {
            $pending = $this->pending($user, $data['challenge']);
            if (isset($pending['verified_at'])) return response()->json(['status' => 'already-verified', ...$this->payload($user, $pending)]);
            if ($failure = PhoneOtpChallenge::check($pending, $data['otp'])) {
                Cache::put($this->key($user), $pending, now()->addDays(7));
                return response()->json(['message' => $failure['message']], $failure['code']);
            }
            try {
                $result = DB::transaction(function () use ($user, $pending) {
                    User::whereKey($user->getKey())->lockForUpdate()->firstOrFail();
                    $record = $user->phoneRecord()->lockForUpdate()->first();
                    if ($record?->getKey() !== $pending['original_phone']) return false;
                    // Only a verified number is owned. Reclaim an unverified record
                    // only here, after proof of possession, and under a row lock.
                    $target = Phone::whereKey($pending['phone'])->lockForUpdate()->first();
                    if ($target?->phone_verified_at) return false;
                    if ($target) $target->delete();
                    $values = ['phone' => $pending['phone'], 'phone_verified_at' => now(), 'phone_otp' => null, 'phone_otp_expires_at' => null];
                    if ($record) $record->update($values);
                    else $user->phoneRecord()->create($values);
                    return true;
                });
            } catch (QueryException $e) {
                if (!in_array((string) $e->getCode(), ['23000', '23505'], true)) throw $e;
                $result = false;
            }
            if (!$result) return response()->json(['message' => 'Nombor telefon telah berubah atau tidak tersedia. Sila mulakan semula.'], 409);
            unset($pending['otp_hash']);
            $pending['verified_at'] = $user->fresh()->phone_verified_at->toIso8601String();
            Cache::put($this->key($user), $pending, now()->addDays(7));
            return response()->json(['status' => 'phone-verified', ...$this->payload($user, $pending)]);
        });
    }
}
