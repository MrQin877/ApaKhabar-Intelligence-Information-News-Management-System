<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GuestCommentIdentity
{
    public const COOKIE = 'apakhabar_guest';

    public function findToken(?string $token): ?object
    {
        return is_string($token) && preg_match('/^[a-f0-9]{64}$/D', $token)
            ? DB::table('guest_comment_identities')->where('token_hash', hash('sha256', $token))->first()
            : null;
    }

    public function issueToken(): string
    {
        $token = bin2hex(random_bytes(32));
        do {
            $username = 'Guest'.random_int(10000, 99999);
        } while (DB::table('guest_comment_identities')->where('username', $username)->exists());
        DB::table('guest_comment_identities')->insert([
            'token_hash' => hash('sha256', $token), 'username' => $username,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $token;
    }

    public function submit(Request $request, callable $create): array
    {
        if ($request->user()) {
            return [$create(null), null];
        }

        // Only API middleware can set this attribute after validating the opaque credential.
        $identity = $request->attributes->get('mobile_guest_identity');
        if (! $identity) {
            $token = $request->cookie(self::COOKIE);
            $identity = is_string($token) && preg_match('/^[a-f0-9]{64}$/', $token)
                ? DB::table('guest_comment_identities')->where('token_hash', hash('sha256', $token))->first()
                : null;

            if (! $identity) {
                $token = $this->issueToken();
                $identity = $this->findToken($token);
            }

            // Cookie is opaque and HttpOnly; only its hash is stored in MySQL.
            Cookie::queue(cookie(self::COOKIE, $token, 60 * 24 * 365 * 5, '/', null, $request->isSecure(), true, false, 'lax'));
        }

        return DB::transaction(function () use ($identity, $create, $request) {
            DB::table('guest_comment_identities')->where('id', $identity->id)->lockForUpdate()->first();
            $day = now('Asia/Jakarta')->toDateString();
            $count = (int) (DB::table('guest_comment_days')->where('guest_id', $identity->id)->where('day', $day)->value('comment_count') ?? 0);
            if ($count >= 3) {
                $exception = ValidationException::withMessages(['quota' => 'Kuota 3 komentar hari ini habis. Coba lagi besok atau masuk untuk lanjut berkomentar.']);
                if ($request->attributes->has('mobile_guest_identity')) {
                    $exception->response = response()->json([
                        'message' => 'Had komen tetamu telah dicapai.',
                        'code' => 'guest_comment_quota_exceeded', 'remaining_quota' => 0,
                        'errors' => $exception->errors(),
                        'resets_at' => now('Asia/Jakarta')->addDay()->startOfDay()->toIso8601String(),
                    ], 422);
                }
                throw $exception;
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
