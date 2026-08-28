<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Notifications\OtpNotification;
use App\Models\Phone;
use Illuminate\Http\Request;

class PhoneVerificationController extends Controller
{
    // POST /settings/phone
    public function store(Request $request)
    {
        $request->validate([
            'phone' => 'required|string|regex:/^\+[1-9]\d{1,14}$/',
        ]);

        $user = auth()->user();

        // ── Check if phone already used by another user ──
        $existingUser = Phone::where('phone', $request->phone)
            ->where('userID', '!=', $user->getKey())
            ->first();

        if ($existingUser) {
            return back()->withErrors([
                'phone' => 'Nombor telefon ini telah didaftarkan oleh pengguna lain.',
            ]);
        }

        $otp = rand(100000, 999999);

        \Log::info('Sending OTP to', ['phone' => $request->phone]);

        $user->phoneRecord()->updateOrCreate(['userID' => $user->getKey()], [
            'phone'                => $request->phone,
            'phone_verified_at'    => null,
            'phone_otp'            => $otp,
            'phone_otp_expires_at' => now()->addMinutes(10),
        ]);

        try {
            $user->notify(new OtpNotification((string) $otp));
        } catch (\Exception $e) {
            \Log::error('OTP failed', ['error' => $e->getMessage()]);
            return back()->withErrors([
                'phone' => 'Gagal menghantar OTP. Sila cuba lagi.',
            ]);
        }

        return back()->with('status', 'otp-sent');
    }

    // POST /settings/phone/verify
    public function verify(Request $request)
    {
        $request->validate(['otp' => 'required|string|size:6']);

        $user = auth()->user();

        if (now()->isAfter($user->phone_otp_expires_at)) {
            return back()->withErrors(['otp' => 'Kod OTP telah tamat tempoh. Sila minta semula.']);
        }

        if ($request->otp !== (string) $user->phone_otp) {
            return back()->withErrors(['otp' => 'Kod OTP tidak sah.']);
        }

        $user->phoneRecord()->update([
            'phone_verified_at'    => now(),
            'phone_otp'            => null,
            'phone_otp_expires_at' => null,
        ]);

        return back()->with('status', 'phone-verified');
    }

    // POST /settings/phone/resend
    public function resend(Request $request)
    {
        $user = auth()->user();

        if (!$user->phone) {
            return back()->withErrors(['phone' => 'Tiada nombor telefon didaftarkan.']);
        }

        $otp = rand(100000, 999999);

        $user->phoneRecord()->update([
            'phone_otp'            => $otp,
            'phone_otp_expires_at' => now()->addMinutes(10),
            'phone_verified_at'    => null,
        ]);

        try {
            $user->notify(new OtpNotification((string) $otp));
        } catch (\Exception $e) {
            \Log::error('OTP resend failed', ['error' => $e->getMessage()]);
        }

        return back()->with('status', 'otp-sent');
    }
}