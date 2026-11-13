<?php

namespace App\Notifications;

use App\Services\Auth\MobilePasswordResetLink;
use Illuminate\Auth\Notifications\ResetPassword;

class MobileResetPassword extends ResetPassword
{
    public function __construct(string $token, private readonly string $destination)
    {
        parent::__construct($token);
    }

    protected function resetUrl($notifiable)
    {
        return app(MobilePasswordResetLink::class)->emailUrl($this->token, $notifiable->getEmailForPasswordReset(), $this->destination);
    }
}
