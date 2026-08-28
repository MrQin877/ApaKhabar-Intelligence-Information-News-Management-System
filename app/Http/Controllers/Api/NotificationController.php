<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

class NotificationController extends Controller
{
    public function index()
    {
        $notifications = auth()->user()
            ->notifications()
            ->get()
            ->map(fn ($n) => [
                'id'           => (string) $n->getKey(),
                'type'         => $n->data['type']    ?? 'pengumuman',
                'title'        => $n->data['title']   ?? '',
                'message'      => $n->data['message'] ?? '',
                'channel'      => $n->data['channel'] ?? 'Aplikasi',
                'sent_at'      => $n->created_at->diffForHumans(),
                'sent_at_full' => $n->created_at->translatedFormat('d M Y, H:i'),
                'is_read'      => !is_null($n->read_at),
            ]);

        return response()->json($notifications);
    }

    public function markRead(string $id)
    {
        $notification = auth()->user()
            ->notifications()
            ->whereKey($id)
            ->first();

        if ($notification) {
            $notification->markAsRead();
        }

        return response()->json(['message' => 'Marked as read']);
    }

    public function markAllRead()
    {
        auth()->user()
            ->unreadNotifications()
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All marked as read']);
    }
}