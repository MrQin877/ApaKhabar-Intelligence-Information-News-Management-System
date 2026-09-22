<?php

namespace App\Services\Village;

use App\Models\User;

class NotificationService
{
    public function listForUser(User $user): array
    {
        return $user->notifications()
            ->get()
            ->map(fn ($notification) => [
                'id'           => (string) $notification->getKey(),
                'type'         => $notification->data['type'] ?? 'pengumuman',
                'title'        => $notification->data['title'] ?? '',
                'message'      => $notification->data['message'] ?? '',
                'channel'      => $notification->data['channel'] ?? 'Aplikasi',
                'sent_at'      => $notification->created_at->diffForHumans(),
                'sent_at_full' => $notification->created_at->translatedFormat('d M Y, H:i'),
                'is_read'      => ! is_null($notification->read_at),
            ])->all();
    }

    public function markRead(User $user, string $id): bool
    {
        $notification = $user->notifications()->whereKey($id)->first();

        if (! $notification) {
            return false;
        }

        $notification->markAsRead();

        return true;
    }

    public function markAllRead(User $user): int
    {
        return $user->unreadNotifications()->update(['read_at' => now()]);
    }
}
