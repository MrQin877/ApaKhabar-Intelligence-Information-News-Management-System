<?php

namespace App\Notifications\Channels;

use App\Models\Notification as NotificationModel;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class MongoDBDatabaseChannel
{
    public function send(mixed $notifiable, Notification $notification): void
    {
        try {
        $result = NotificationModel::create([
            //'id'              => (string) Str::uuid(),
            'type'            => get_class($notification),
            'notifiable_id'   => (string) $notifiable->getKey(),
            'notifiable_type' => get_class($notifiable),
            'data'            => $notification->toArray($notifiable),
            'read_at'         => null,
        ]);

        \Log::info('Notification created', ['id' => $result->id]);

        } catch (\Exception $e) {
            \Log::error('Notification failed', ['error' => $e->getMessage()]);
        }
    }
}