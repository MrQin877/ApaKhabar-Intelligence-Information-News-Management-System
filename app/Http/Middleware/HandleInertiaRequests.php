<?php

namespace App\Http\Middleware;

use App\Models\Comment;
use App\Models\NewsCategory;
use App\Models\Notification;
use App\Models\ShortVideoComment;
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
            'publishResult' => fn () => $request->session()->get('publishResult'),
            'auth' => [
                'user' => $request->user() ? [...$request->user()->toArray(), ...$request->user()->demographicProfile()] : null,
            ],
            'moderationPendingCount' => function () use ($request) {
                $user = $request->user();

                return $user && $user->hasVerifiedEmail() && ($user->isAdmin() || $user->isModerator())
                    ? Comment::awaitingReview()->count() + ShortVideoComment::awaitingReview()->count() : 0;
            },
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',

            'categories' => fn () => NewsCategory::active()
                ->orderBy('display_order')->orderBy('name')->pluck('name')->values(),

            'unreadNotifications' => function () use ($request) {
                if (! $request->user()) {
                    return 0;
                }

                return Notification::where('notifiable_id', $request->user()->getKey())
                    ->whereNull('read_at')
                    ->count();
            },
        ];
    }
}
