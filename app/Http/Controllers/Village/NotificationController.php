<?php

namespace App\Http\Controllers\Village;

use App\Http\Controllers\Controller;
use App\Services\Village\NotificationService;
use Inertia\Inertia;

class NotificationController extends Controller
{
    public function __construct(protected NotificationService $notificationService)
    {
    }

    public function index()
    {
        $notifications = $this->notificationService->listForUser(auth()->user());

        if (request()->expectsJson() || request()->is('api/*')) {
            return response()->json([
                'notifications' => $notifications,
                'role' => auth()->user()->role,
            ]);
        }

        return Inertia::render('notifications/index', [
            'notifications' => $notifications,
            'role'          => auth()->user()->role,
        ]);
    }

    public function markRead(string $id)
    {
        $this->notificationService->markRead(auth()->user(), $id);

        if (request()->expectsJson() || request()->is('api/*')) {
            return response()->json(['message' => 'Notification marked as read']);
        }

        return back();
    }

    public function markAllRead()
    {
        $this->notificationService->markAllRead(auth()->user());

        if (request()->expectsJson() || request()->is('api/*')) {
            return response()->json(['message' => 'All notifications marked as read']);
        }

        return back();
    }
}

