<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\Auth\MobilePasswordResetLink;
use Illuminate\Http\Request;

class MobilePasswordResetController extends Controller
{
    public function __invoke(Request $request, MobilePasswordResetLink $links)
    {
        $parameters = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email'],
            'return_url' => ['nullable', 'string', 'max:2048'],
        ]);
        // Legacy emails use the configured destination only; they cannot override it.
        if (isset($parameters['return_url'])) {
            abort_unless($request->hasValidRelativeSignature(), 403, 'Pautan tidak sah atau telah tamat tempoh. Minta pautan baharu.');
        }
        $destination = $links->destination($parameters['return_url'] ?? null);
        unset($parameters['return_url']);
        $separator = str_contains($destination, '?') ? '&' : '?';

        return redirect()->away($destination.$separator.http_build_query($parameters, '', '&', PHP_QUERY_RFC3986))
            ->header('Referrer-Policy', 'no-referrer')->header('Cache-Control', 'no-store');
    }
}
