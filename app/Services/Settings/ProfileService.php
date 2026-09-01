<?php

namespace App\Services\Settings;

use App\Models\Email;
use App\Models\User;
use Illuminate\Http\Request;

class ProfileService
{
    public function getProfilePayload(User $user): array
    {
        return [
            'id' => (string) $user->getKey(),
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
        ];
    }

    public function updateProfile(User $user, array $validated): bool
    {
        $emailChanged = $validated['email'] !== $user->email;

        $user->fill(['name' => $validated['name']]);
        $user->save();

        if ($emailChanged) {
            $user->emailRecord()->update([
                'email' => $validated['email'],
                'email_verified_at' => null,
            ]);
        }

        return true;
    }

    public function deleteProfile(User $user): void
    {
        $user->delete();
    }
}
