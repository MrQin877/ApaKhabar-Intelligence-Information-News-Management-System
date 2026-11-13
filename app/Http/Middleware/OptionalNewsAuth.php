<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

// News stays public; resolve optional mobile identity through existing validation.
class OptionalNewsAuth
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->hasHeader('Authorization')) {
            return app(ApiAuth::class)->handle($request, $next);
        }

        return $next($request);
    }
}
