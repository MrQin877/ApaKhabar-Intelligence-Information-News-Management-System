<?php

namespace App\Notifications\Channels;

use App\Services\SmsService;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

class Bulk360Channel
{
    public function __construct(protected SmsService $sms) {}

    public function send(mixed $notifiable, Notification $notification): void
    {
        if (!method_exists($notification, 'toBulk360')) {
            return;
        }

        $data = $notification->toBulk360($notifiable);

        if (empty($data['to'])) {
            Log::warning('Bulk360Channel: no phone number', [
                'notifiable' => get_class($notifiable),
            ]);
            return;
        }

        $this->sms->sendSms($data['to'], $data['message']);
    }
}