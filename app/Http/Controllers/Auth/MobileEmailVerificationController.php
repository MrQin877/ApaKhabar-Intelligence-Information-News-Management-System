<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\MobileVerifyEmail;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MobileEmailVerificationController extends Controller
{
    public function send(Request $request)
    {
        $user = $request->user();
        if (! $user->email) {
            return response()->json(['message' => 'Simpan alamat e-mail di profil terlebih dahulu.'], 422);
        }
        if ($user->email_verified_at) {
            return response()->json(['status' => 'already-verified', 'email' => $user->email]);
        }

        $user->notify(new MobileVerifyEmail);

        return response()->json(['status' => 'verification-link-sent', 'email' => $user->email]);
    }

    public function verify(Request $request, string $id, string $hash)
    {
        $valid = false;
        if ($request->hasValidSignature()) {
            $valid = DB::transaction(function () use ($id, $hash) {
                $user = User::find($id);
                $email = $user?->emailRecord()->lockForUpdate()->first();
                if (! $email || ! hash_equals(sha1($email->getKey()), $hash)) {
                    return false;
                }
                $user->setRelation('emailRecord', $email);
                if ($user->markEmailAsVerified()) {
                    event(new Verified($user));
                }

                return true;
            });
        }

        return response()->view('auth.mobile-email-verification', [
            'verified' => $valid,
            'appUrl' => config('services.mobile.verification_return_url'),
        ], $valid ? 200 : 403)->header('Referrer-Policy', 'no-referrer')
            ->header('Cache-Control', 'no-store');
    }
}
