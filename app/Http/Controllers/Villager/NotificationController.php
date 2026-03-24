<?php

namespace App\Http\Controllers\Villager;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class NotificationController extends Controller
{
    public function index()
    {
        $notifications = auth()->user()
            ->notifications()
            ->latest()
            ->get()
            ->map(fn ($n) => [
                'id'           => $n->id,
                'type'         => $n->data['type'],        // 'darurat' | 'pengumuman'
                'title'        => $n->data['title'],
                'message'      => $n->data['message'],
                'channel'      => $n->data['channel'],
                'sent_at'      => $n->created_at->diffForHumans(),
                'sent_at_full' => $n->created_at->translatedFormat('d M Y, H:i'),
                'is_read'      => !is_null($n->read_at),
            ]);

        return Inertia::render('villager/notifications/index', [
            'notifications' => $notifications,
        ]);
    }

    public function markRead(string $id)
    {
        auth()->user()
            ->notifications()
            ->findOrFail($id)
            ->markAsRead();

        return back();
    }

    public function markAllRead()
    {
        auth()->user()->unreadNotifications->markAsRead();

        return back();
    }
}