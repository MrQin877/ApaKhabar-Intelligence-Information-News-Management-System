<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GuestCommentIdentity
{
    public const COOKIE = 'apakhabar_guest';

    public function submit(Request $request, callable $create): array
    {
        if ($request->user()) {
            return [$create(null), null];
        }

        $token = $request->cookie(self::COOKIE);
        $identity = is_string($token) && preg_match('/^[a-f0-9]{64}$/', $token)
            ? DB::table('guest_comment_identities')->where('token_hash', hash('sha256', $token))->first()
            : null;

        if (! $identity) {
            $token = bin2hex(random_bytes(32));
            do {
                $username = 'Guest'.random_int(10000, 99999);
            } while (DB::table('guest_comment_identities')->where('username', $username)->exists());
            $id = DB::table('guest_comment_identities')->insertGetId([
                'token_hash' => hash('sha256', $token), 'username' => $username,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            $identity = (object) ['id' => $id, 'username' => $username];
        }

        // Cookie is opaque and HttpOnly; only its hash is stored in MySQL.
        Cookie::queue(cookie(self::COOKIE, $token, 60 * 24 * 365 * 5, '/', null, $request->isSecure(), true, false, 'lax'));

        return DB::transaction(function () use ($identity, $create) {
            DB::table('guest_comment_identities')->where('id', $identity->id)->lockForUpdate()->first();
            $day = now('Asia/Jakarta')->toDateString();
            $count = (int) (DB::table('guest_comment_days')->where('guest_id', $identity->id)->where('day', $day)->value('comment_count') ?? 0);
            if ($count >= 3) {
                throw ValidationException::withMessages(['quota' => 'Kuota 3 komentar hari ini habis. Coba lagi besok atau masuk untuk lanjut berkomentar.']);
            }

            $comment = $create($identity->username);
            DB::table('guest_comment_days')->updateOrInsert(
                ['guest_id' => $identity->id, 'day' => $day],
                ['comment_count' => $count + 1],
            );

            return [$comment, 2 - $count];
        });
    }
}
