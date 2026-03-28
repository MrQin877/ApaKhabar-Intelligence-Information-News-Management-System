<?php

namespace App\Http\Middleware;

use App\Models\News;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',

            // ↓ Share unique categories from DB to all pages
            'categories' => News::all()->pluck('category')->unique()->filter()->sort()->values(),

            'unreadNotifications' => function () use ($request) {
                if (!$request->user()) return 0;
                return \App\Models\Notification::where('notifiable_id', (string) $request->user()->id)
                    ->whereNull('read_at')
                    ->count();
            }
        ];
    }
}