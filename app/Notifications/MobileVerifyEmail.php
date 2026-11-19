<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\URL;

class MobileVerifyEmail extends VerifyEmail
{
    public function __construct(public ?string $returnUrl = null) {}

    protected function verificationUrl($notifiable)
    {
        return URL::temporarySignedRoute(
            'mobile.verification.verify',
            now()->addMinutes(config('auth.verification.expire', 60)),
            ['id' => $notifiable->getKey(), 'hash' => sha1($notifiable->getEmailForVerification()),
                'return_url' => $this->returnUrl],
        );
    }
}
