<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;

class MobileGuestChallenge
{
    public function issue(Request $request, string $kind, string $id): string
    {
        return Crypt::encryptString(json_encode([
            'purpose' => 'mobile_guest_comment', 'kind' => $kind, 'id' => $id,
            'identity' => $request->attributes->get('mobile_guest_identity')->token_hash,
            'time' => now()->timestamp,
        ]));
    }

    public function validate(Request $request, string $kind, string $id, array $data): void
    {
        try {
            $claim = json_decode(Crypt::decryptString($data['challenge'] ?? ''), true, flags: JSON_THROW_ON_ERROR);
            $age = now()->timestamp - $claim['time'];
            $valid = $claim['purpose'] === 'mobile_guest_comment' && $claim['kind'] === $kind
                && $claim['id'] === $id && $age >= 3 && $age <= 7200
                && hash_equals($request->attributes->get('mobile_guest_identity')->token_hash, $claim['identity']);
        } catch (\Throwable) {
            $valid = false;
        }
        if (! $valid) {
            throw ValidationException::withMessages(['challenge' => 'Muat semula komen dan tunggu beberapa saat sebelum menghantar.']);
        }
    }
}
