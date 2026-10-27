<?php

namespace App\Services\Settings;

use App\Models\Email;
use App\Models\User;

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

        $user->fill(array_intersect_key($validated, array_flip(['name', 'date_of_birth', 'citizenship', 'gender', 'ethnicity'])));
        $user->save();

        if ($emailChanged) {
            Email::updateOrCreate(
                ['userID' => $user->getKey()],
                [
                    'email' => $validated['email'],
                    'email_verified_at' => null,
                ]
            );
        }

        return true;
    }

    public function deleteProfile(User $user): void
    {
        $user->delete();
    }
}
