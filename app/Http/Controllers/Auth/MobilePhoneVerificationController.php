<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\OtpNotification;
use App\Services\Settings\PhoneOtpRateLimiter;
use App\Services\SmsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class MobilePhoneVerificationController extends Controller
{
    public function __construct(private PhoneOtpRateLimiter $limiter) {}

    private function payload(User $user): array
    {
        $user->load('phoneRecord');
        $limits = $this->limiter->status($user, $user->phone);

        return [
            'phone' => $user->phone,
            'phone_verified_at' => $user->phone_verified_at?->toIso8601String(),
            'otp_pending' => ! $user->phone_verified_at && $user->phone_otp !== null
                && $user->phone_otp_expires_at?->isFuture() === true,
            'retry_after' => max(0, $limits['retryAt'] - now()->timestamp),
            'daily_limit_reached' => $limits['dailyLimitReached'],
            'daily_reset_after' => max(0, $limits['dailyResetAt'] - now()->timestamp),
        ];
    }

    private function attemptsKey(User $user): string
    {
        return 'mobile-phone-otp:verify:'.$user->getKey();
    }

    public function status(Request $request)
    {
        return response()->json($this->payload($request->user()))->header('Cache-Control', 'no-store');
    }

    public function send(Request $request, SmsService $sms)
    {
        $user = $request->user();
        $user->load('phoneRecord');
        if (! $user->phone) {
            return response()->json(['message' => 'Simpan nombor telefon di profil terlebih dahulu.'], 422);
        }
        if ($user->phone_verified_at) {
            return response()->json(['status' => 'already-verified', ...$this->payload($user)]);
        }

        $phone = $user->phone;
        try {
            $this->limiter->reserve($user, $phone);
        } catch (ValidationException $exception) {
            $payload = $this->payload($user);
            $retry = $payload['daily_limit_reached'] ? $payload['daily_reset_after'] : max(1, $payload['retry_after']);

            return response()->json(['message' => $exception->errors()['phone'][0], ...$payload], 429)
                ->header('Retry-After', (string) $retry);
        }

        return DB::transaction(function () use ($user, $phone, $sms) {
            $record = $user->phoneRecord()->lockForUpdate()->first();
            if (! $record || $record->getKey() !== $phone) {
                return response()->json(['message' => 'Nombor telefon telah berubah. Sila muat semula.'], 409);
            }
            if ($record->phone_verified_at) {
                return response()->json(['status' => 'already-verified', ...$this->payload($user)]);
            }

            $otp = (string) random_int(100000, 999999);
            // Keep the shared phone record compatible with the existing web OTP flow.
            $record->update(['phone_otp' => $otp, 'phone_otp_expires_at' => now()->addMinutes(10)]);
            $user->setRelation('phoneRecord', $record);
            $message = (new OtpNotification($otp))->toBulk360($user);
            if (! $sms->sendMobileOtp($message['to'], $message['message'])) {
                $record->update(['phone_otp' => null, 'phone_otp_expires_at' => null]);

                return response()->json([
                    'message' => 'Gagal menghantar OTP. Sila cuba lagi selepas tempoh menunggu.',
                    ...$this->payload($user),
                ], 503);
            }
            RateLimiter::clear($this->attemptsKey($user));

            return response()->json(['status' => 'otp-sent', ...$this->payload($user)]);
        });
    }

    public function verify(Request $request)
    {
        $data = $request->validate([
            'phone' => ['required', 'string'],
            'otp' => ['required', 'string', 'regex:/^[0-9]{6}$/'],
        ]);
        $user = $request->user();

        return DB::transaction(function () use ($user, $data) {
            $record = $user->phoneRecord()->lockForUpdate()->first();
            if (! $record || $record->getKey() !== $data['phone']) {
                return response()->json(['message' => 'Nombor telefon telah berubah. Sila muat semula.'], 409);
            }
            if ($record->phone_verified_at) {
                return response()->json(['status' => 'already-verified', ...$this->payload($user)]);
            }
            $key = $this->attemptsKey($user);
            if (RateLimiter::tooManyAttempts($key, 5)) {
                return response()->json(['message' => 'Terlalu banyak kod yang salah. Sila minta OTP baharu atau cuba lagi kemudian.'], 429)
                    ->header('Retry-After', (string) RateLimiter::availableIn($key));
            }
            if (! $record->phone_otp || ! $record->phone_otp_expires_at?->isFuture()) {
                return response()->json(['message' => 'Kod OTP tiada atau telah tamat tempoh. Sila minta semula.'], 422);
            }
            if (! hash_equals((string) $record->phone_otp, $data['otp'])) {
                RateLimiter::hit($key, 600);

                return response()->json(['message' => 'Kod OTP tidak sah.'], 422);
            }
            $record->update(['phone_verified_at' => now(), 'phone_otp' => null, 'phone_otp_expires_at' => null]);
            RateLimiter::clear($key);

            return response()->json(['status' => 'phone-verified', ...$this->payload($user)]);
        });
    }
}
