<?php

namespace App\Http\Responses;

use Illuminate\Http\RedirectResponse;
use Laravel\Fortify\Contracts\EmailVerificationNotificationSentResponse as EmailVerificationNotificationSentResponseContract;
use Laravel\Fortify\Fortify;

class EmailVerificationNotificationSentResponse implements EmailVerificationNotificationSentResponseContract
{
    public function toResponse($request): RedirectResponse
    {
        return redirect()
            ->route('verification.notice')
            ->with('status', Fortify::VERIFICATION_LINK_SENT);
    }
}
