<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Fortify\ResetUserPassword;
use App\Http\Controllers\Controller;
use App\Models\Phone;
use App\Models\User;
use App\Notifications\OtpNotification;
use App\Services\Settings\PhoneOtpRateLimiter;
use App\Services\SmsService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use App\Services\Settings\PhoneOtpChallenge;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Shared, unauthenticated recovery API for web and mobile; never verifies or changes a phone. */
class PhonePasswordResetController extends Controller
{
    public function __construct(private PhoneOtpRateLimiter $limiter) {}

    private function key(string $challenge): string { return 'phone-password-reset:'.$challenge; }
    private function activeKey(User $user): string { return 'phone-password-reset:user:'.$user->getKey(); }

    private function pending(string $challenge): array
    {
        $pending = Cache::get($this->key($challenge));
        abort_unless($pending, 410, 'Permintaan telah tamat tempoh. Sila mulakan semula.');
        return $pending;
    }

    private function owner(array $pending, bool $lock = false): User
    {
        $query = User::whereKey($pending['user_id']);
        $user = ($lock ? $query->lockForUpdate() : $query)->first();
        $phoneQuery = Phone::whereKey($pending['phone'])->where('userID', $pending['user_id'])->whereNotNull('phone_verified_at');
        $phone = ($lock ? $phoneQuery->lockForUpdate() : $phoneQuery)->first();
        abort_unless($user && $phone
            && hash_equals($pending['password_fingerprint'], hash('sha256', $user->password))
            && Cache::get($this->activeKey($user)) === $pending['challenge'],
            410, 'Permintaan tidak lagi sah. Sila mulakan semula.');
        return $user;
    }

    private function payload(User $user, array $pending): array
    {
        $limits = $this->limiter->status($user, $pending['phone']);
        return [
            'challenge' => $pending['challenge'], 'phone' => $pending['phone'],
            // OTP here authorizes a password reset, not a profile verification.
            'phone_verified_at' => $user->phone_verified_at?->toIso8601String(),
            'otp_pending' => isset($pending['otp_hash']) && $pending['expires_at'] > now()->timestamp,
            'retry_after' => max(0, $limits['retryAt'] - now()->timestamp),
            'daily_limit_reached' => $limits['dailyLimitReached'],
            'daily_reset_after' => max(0, $limits['dailyResetAt'] - now()->timestamp),
        ];
    }

    private function locked(int $userId, callable $callback)
    {
        try {
            return Cache::lock('phone-password-reset:lock:'.$userId, 30)->block(5, $callback);
        } catch (LockTimeoutException) {
            return response()->json(['message' => 'Permintaan sedang diproses. Sila cuba lagi sebentar.'], 409);
        }
    }

    private function save(array $pending): void
    {
        Cache::put($this->key($pending['challenge']), $pending, now()->addDays(7));
    }

    public function status(Request $request)
    {
        $data = $request->validate(['challenge' => ['required', 'uuid']]);
        $pending = $this->pending($data['challenge']);
        return response()->json($this->payload($this->owner($pending), $pending))->header('Cache-Control', 'no-store');
    }

    public function send(Request $request, SmsService $sms)
    {
        $data = $request->validate([
            'phone' => ['required_without:challenge', 'nullable', 'string', 'regex:/^\+(60|62)[1-9]\d{6,12}$/'],
            'challenge' => ['nullable', 'uuid'],
        ]);
        $existing = !empty($data['challenge']) ? $this->pending($data['challenge']) : null;
        $user = $existing ? $this->owner($existing) : Phone::whereKey($data['phone'])->whereNotNull('phone_verified_at')->first()?->user;
        if (!$user) return response()->json(['message' => 'Tidak dapat menetapkan semula kata laluan. Pastikan nombor telefon telah didaftarkan dan disahkan.'], 422);

        return $this->locked($user->getKey(), function () use ($user, $data, $existing, $sms) {
            $user->refresh();
            $pending = $existing ? $this->pending($existing['challenge']) : [
                'challenge' => (string) Str::uuid(), 'phone' => $data['phone'], 'user_id' => $user->getKey(),
                'password_fingerprint' => hash('sha256', $user->password), 'expires_at' => 0,
            ];
            if ($existing) $this->owner($pending);
            else abort_unless($user->phone === $pending['phone'] && $user->phone_verified_at, 410);
            try {
                // Same per-user AND per-number allowance as profile verification and phone changes.
                $this->limiter->reserve($user, $pending['phone']);
            } catch (ValidationException $e) {
                $payload = $this->payload($user, $pending);
                return response()->json(['message' => $e->errors()['phone'][0], ...$payload], 429)
                    ->header('Retry-After', (string) ($payload['daily_limit_reached'] ? $payload['daily_reset_after'] : max(1, $payload['retry_after'])));
            }
            $otp = (string) random_int(100000, 999999);
            $message = (new OtpNotification($otp))->toBulk360($user);
            if (!$sms->sendMobileOtp($message['to'], $message['message'])) {
                return response()->json(['message' => 'Gagal menghantar OTP. Sila cuba lagi selepas tempoh menunggu.', ...$this->payload($user, $pending)], 503);
            }
            // Successful resend supersedes the old OTP and any previous reset authorization.
            unset($pending['token_hash'], $pending['token_expires_at']);
            $pending = array_replace($pending, PhoneOtpChallenge::issue($otp));
            $this->save($pending);
            Cache::put($this->activeKey($user), $pending['challenge'], now()->addDays(7));
            return response()->json(['status' => 'otp-sent', ...$this->payload($user, $pending)])->header('Cache-Control', 'no-store');
        });
    }

    public function verify(Request $request)
    {
        $data = $request->validate(['challenge' => ['required', 'uuid'], 'otp' => PhoneOtpChallenge::rules()]);
        $snapshot = $this->pending($data['challenge']);
        return $this->locked($snapshot['user_id'], function () use ($data) {
            $pending = $this->pending($data['challenge']);
            $user = $this->owner($pending);
            if ($failure = PhoneOtpChallenge::check($pending, $data['otp'])) {
                $this->save($pending);
                return response()->json(['message' => $failure['message']], $failure['code']);
            }
            $token = Str::random(64);
            unset($pending['otp_hash']);
            $pending['token_hash'] = hash('sha256', $token);
            $pending['token_expires_at'] = now()->addMinutes(10)->timestamp;
            $this->save($pending);
            return response()->json(['status' => 'reset-authorized', 'reset_token' => $token, ...$this->payload($user, $pending)])
                ->header('Cache-Control', 'no-store');
        });
    }

    public function reset(Request $request, ResetUserPassword $resetter)
    {
        $data = $request->validate([
            'challenge' => ['required', 'uuid'], 'token' => ['required', 'string', 'size:64'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ]);
        $snapshot = $this->pending($data['challenge']);
        return $this->locked($snapshot['user_id'], function () use ($data, $resetter) {
            $pending = $this->pending($data['challenge']);
            abort_unless(isset($pending['token_hash']) && $pending['token_expires_at'] > now()->timestamp
                && hash_equals($pending['token_hash'], hash('sha256', $data['token'])), 422, 'Token tidak sah atau telah tamat tempoh.');
            $user = DB::transaction(function () use ($pending, $data, $resetter) {
                // Recheck phone ownership and intervening password changes at the point of reset.
                $user = $this->owner($pending, true);
                $resetter->reset($user, $data);
                $user->setRememberToken(Str::random(60));
                $user->save();
                return $user;
            });
            Cache::forget($this->key($pending['challenge']));
            Cache::forget($this->activeKey($user));
            event(new PasswordReset($user));
            return response()->json(['message' => 'Kata laluan berjaya ditukar. Sila log masuk.'])->header('Cache-Control', 'no-store');
        });
    }
}
