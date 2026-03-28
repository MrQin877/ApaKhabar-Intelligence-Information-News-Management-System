<?php

namespace App\Notifications;

use App\Models\Broadcast;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BroadcastNotification extends Notification
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(public Broadcast $broadcast) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $channels = ['mongodb'];  // always in-app

        if (in_array('sms', $this->broadcast->channels ?? [])
            && $notifiable->phone
            && $notifiable->hasVerifiedPhone()
        ) {
            $channels[] = 'bulk360';  // ← use bulk360 instead of vonage
        }

        return $channels;
    }

    /*
     Get the mail representation of the notification.
     
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->line('The introduction to the notification.')
            ->action('Notification Action', url('/'))
            ->line('Thank you for using our application!');
    }
    */

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */

    // ── MongoDB in-app notification ────────────────────────
    public function toArray(object $notifiable): array
    {
        return [
            'broadcast_id' => (string) $this->broadcast->id,
            'type'         => $this->broadcast->category,
            'title'        => $this->broadcast->title,
            'message'      => $this->broadcast->message,
            'channel'      => implode(', ', $this->broadcast->channels ?? []),
            'audience'     => $this->broadcast->audience,
        ];
    }

    // ── Vonage SMS ─────────────────────────────────────────
    public function toBulk360(object $notifiable): array
    {
        return [
            'to'      => $notifiable->phone,
            'message' => "[{$this->broadcast->category}] {$this->broadcast->title}: {$this->broadcast->message}",
        ];
    }
}
