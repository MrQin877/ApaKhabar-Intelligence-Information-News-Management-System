<?php

namespace App\Http\Middleware;

use App\Services\GuestCommentIdentity;
use Closure;
use Illuminate\Http\Request;

class MobileCommentAccess
{
    public function handle(Request $request, Closure $next)
    {
        // An invalid bearer must never be silently downgraded to a guest.
        if ($request->hasHeader('Authorization')) {
            return app(ApiAuth::class)->handle($request, $next);
        }
        $identity = app(GuestCommentIdentity::class)->findToken($request->header('X-Guest-Token'));
        if (! $identity) {
            return response()->json(['message' => 'Identiti tetamu tidak sah.', 'code' => 'invalid_guest_identity'], 401);
        }
        $request->setUserResolver(fn () => null);
        $request->attributes->set('mobile_guest_identity', $identity);

        return $next($request);
    }
}
