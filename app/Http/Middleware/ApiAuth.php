<?php

namespace App\Http\Middleware;

use App\Models\PersonalAccessToken;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;

class ApiAuth
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!str_contains($token, '|')) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        [$id, $plainText] = explode('|', $token, 2);

        $accessToken = PersonalAccessToken::whereKey($id)->first();

        if (!$accessToken) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!hash_equals($accessToken->token, hash('sha256', $plainText))) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user = User::find($accessToken->tokenable_id);

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Set the authenticated user
        auth()->setUser($user);
        $request->setUserResolver(fn() => $user);

        return $next($request);
    }
}