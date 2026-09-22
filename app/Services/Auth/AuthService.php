<?php

namespace App\Services\Auth;

use App\Models\Email;
use App\Models\PersonalAccessToken;
use App\Models\Phone;
use App\Models\User;
use App\Models\UserRole;
use App\Notifications\MobileVerifyEmail;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

class AuthService
{
    public function login(?string $email, ?string $phone, string $password): ?array
    {
        $user = null;

        if ($email) {
            $user = User::whereHas('emailRecord', function ($query) use ($email) {
                $query->where('email', $email);
            })->first();
        }

        if (! $user && $phone) {
            $user = User::whereHas('phoneRecord', function ($query) use ($phone) {
                $query->where('phone', $phone);
            })->first();
        }

        if (! $user || ! Hash::check($password, $user->password)) {
            return null;
        }

        return [
            'token' => $user->createToken('mobile-app')->plainTextToken,
            'user' => $this->profile($user),
        ];
    }

    public function register(string $name, ?string $email, ?string $phone, string $password): array
    {
        if (empty($email) && empty($phone)) {
            throw new \InvalidArgumentException('Either email or phone is required.');
        }

        $user = DB::transaction(function () use ($name, $email, $phone, $password) {
            $user = User::create([
                'name' => $name,
                'password' => Hash::make($password),
                'roleID' => UserRole::firstOrCreate(['name' => 'villager'])->getKey(),
            ]);

            if (! empty($email)) {
                Email::create([
                    'email' => $email,
                    'userID' => $user->getKey(),
                ]);

            }

            if (! empty($phone)) {
                $user->phoneRecord()->create([
                    'phone' => $phone,
                    'phone_otp' => null,
                    'phone_otp_expires_at' => null,
                    'phone_verified_at' => null,
                ]);
            }

            return $user;
        });

        if ($user->email) {
            $user->notify(new MobileVerifyEmail);
        }

        return [
            'token' => $user->createToken('mobile-app')->plainTextToken,
            'user' => $this->profile($user),
        ];
    }

    public function logout(User $user, ?string $token): void
    {
        $user->update(['push_token' => null]);

        if ($token && str_contains($token, '|')) {
            [$id] = explode('|', $token, 2);
            PersonalAccessToken::whereKey($id)->delete();
        }
    }

    public function profile(User $user): array
    {
        // Verification may have changed since these relations were first loaded.
        $user->load(['emailRecord', 'phoneRecord']);

        return [
            'id' => (string) $user->getKey(),
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            'phone_verified_at' => $user->phone_verified_at?->toIso8601String(),
            'role' => $user->role,
        ];
    }

    public function savePushToken(User $user, string $token): void
    {
        $user->update(['push_token' => $token]);
    }

    public function removePushToken(User $user): void
    {
        $user->update(['push_token' => null]);
    }

    public function forgotPassword(string $email): bool
    {
        \Illuminate\Auth\Notifications\ResetPassword::createUrlUsing(function ($user, string $token) {
            $email = urlencode($user->email);

            return url("/mobile/reset-password?token={$token}&email={$email}");
        });

        $status = Password::sendResetLink(['email' => $email]);

        return $status === Password::RESET_LINK_SENT;
    }

    public function resetPassword(string $token, string $email, string $password): bool
    {
        $status = Password::reset([
            'token' => $token,
            'email' => $email,
            'password' => $password,
            'password_confirmation' => $password,
        ], function (User $user, string $newPassword) {
            $user->forceFill([
                'password' => Hash::make($newPassword),
            ])->save();

            event(new PasswordReset($user));
        });

        return $status === Password::PASSWORD_RESET;
    }
}
