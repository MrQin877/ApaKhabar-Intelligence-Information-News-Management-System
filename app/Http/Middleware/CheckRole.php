<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (!auth()->check()) {
            return redirect()->route('login');
        }

        $userRole = auth()->user()->role;

        // Role is allowed → continue
        if (in_array($userRole, $roles)) {
            return $next($request);
        }

        // Wrong role → redirect to their own place
        if (auth()->user()->isAdmin() || auth()->user()->isModerator()) {
            return redirect()->route('admin.dashboard');
        }

        // Villager tried to access admin → send home
        return redirect()->route('home');
    }
}