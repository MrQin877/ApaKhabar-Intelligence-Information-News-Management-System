<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Vonage\Client;
use Vonage\Client\Credentials\Basic;
use Vonage\SMS\Message\SMS;

class SmsService
{
    protected Client $client;

    public function __construct()
    {
        $this->client = new Client(
            new Basic(
                config('services.vonage.key'),
                config('services.vonage.secret')
            )
        );
    }

    public function sendSms(string $to, string $message): bool
    {
        try {
            $this->client->sms()->send(
                new SMS($to, config('services.vonage.from'), $message)
            );

            Log::info('SMS sent via Vonage', ['to' => $to]);
            return true;

        } catch (\Exception $e) {
            Log::error('SMS failed via Vonage', [
                'to'    => $to,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }
}