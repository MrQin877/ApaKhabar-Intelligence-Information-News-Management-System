<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\PersonalAccessToken;
use App\Models\Email;
use App\Models\UserRole;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = User::whereHas('emailRecord', function ($query) use ($request) {
            $query->where('email', $request->email);
        })->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $token = $user->createToken('mobile-app')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'    => (string) $user->getKey(),
                'name'  => $user->name,
                'email' => $user->email,
                'role'  => $user->role,
            ],
        ]);
    }

    public function register(Request $request)
    {
        $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:emails,email',
            'password' => 'required|min:8',
        ]);

        $user = User::create([
            'name'     => $request->name,
            'password' => Hash::make($request->password),
            'roleID'   => UserRole::firstOrCreate(['name' => 'villager'])->getKey(),
        ]);

        Email::create([
            'email' => $request->email,
            'userID' => $user->getKey(),
        ]);

        $token = $user->createToken('mobile-app')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'    => (string) $user->getKey(),
                'name'  => $user->name,
                'email' => $user->email,
                'role'  => $user->role,
            ],
        ], 201);
    }

    public function logout(Request $request)
    {
        // ── Clear push token on logout ──
        $request->user()?->update(['push_token' => null]);

        $token = $request->bearerToken();

        if ($token && str_contains($token, '|')) {
            [$id] = explode('|', $token, 2);
            PersonalAccessToken::whereKey($id)->delete();
        }

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function profile(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'id'    => (string) $user->getKey(),
            'name'  => $user->name,
            'email' => $user->email,
            'role'  => $user->role,
        ]);
    }

    // ── Save push token ────────────────────────────────────
    public function savePushToken(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
        ]);

        $request->user()->update([
            'push_token' => $request->token,
        ]);

        return response()->json([
            'message' => 'Push token saved',
        ]);
    }

    // ── Remove push token ──────────────────────────────────
    public function removePushToken(Request $request)
    {
        $request->user()->update([
            'push_token' => null,
        ]);

        return response()->json([
            'message' => 'Push token removed',
        ]);
    }

    // ── Forgot Password ────────────────────────────────────
    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        \Illuminate\Auth\Notifications\ResetPassword::createUrlUsing(function ($user, string $token) {
            $email = urlencode($user->email);
            return url("/mobile/reset-password?token={$token}&email={$email}");
        });

        $status = Password::sendResetLink($request->only('email'));

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json(['message' => 'Reset link sent to your email.']);
        }

        return response()->json(['message' => 'Email not found.'], 404);
    }

    // ── Reset Password ─────────────────────────────────────
    public function resetPassword(Request $request)
    {
        $request->validate([
            'token'    => 'required',
            'email'    => 'required|email',
            'password' => 'required|min:8|confirmed',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->save();

                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Password reset successfully.']);
        }

        return response()->json(['message' => 'Invalid or expired token.'], 422);
    }
}