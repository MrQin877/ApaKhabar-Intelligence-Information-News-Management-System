<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class OtpNotification extends Notification
{
    use Queueable;

    public function __construct(protected string $otp) {}

    public function via(object $notifiable): array
    {
        return ['bulk360'];
    }

    public function toBulk360(object $notifiable): array
    {
        return [
            'to'      => $notifiable->phone,
            'message' => "ApaKhabar: Kod pengesahan anda ialah {$this->otp}. Sah selama 10 minit.",
        ];
    }
}