<?php

use App\Http\Middleware\CheckRole;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\MobileCommentAccess;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

// ← ADD THIS

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // ← ADD THIS
        $middleware->api(prepend: [
            EnsureFrontendRequestsAreStateful::class,
        ]);

        // Resolve mobile bearer/guest identity before choosing the throttle key.
        $middleware->prependToPriorityList(ThrottleRequests::class, MobileCommentAccess::class);

        $middleware->alias([
            'role' => CheckRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (PostTooLargeException $exception, Request $request) {
            $message = 'Unggahan terlalu besar. Maksimum 20 MB per file dan 5 file per unggahan. Jika ukuran sudah sesuai, periksa batas unggahan server.';
            if ($request->is('admin/short-videos/*')) {
                $message = 'Video maksimal 100 MB dan sampul maksimal 5 MB. Periksa juga batas unggahan PHP/proxy server.';
            }
            if ($request->expectsJson()) {
                return response()->json(['message' => $message], 413);
            }

            // Do not invoke the debug renderer: serializing the rejected body can exhaust memory.
            return response()->view('errors.413', ['message' => $message], 413);
        });
    })->create();
