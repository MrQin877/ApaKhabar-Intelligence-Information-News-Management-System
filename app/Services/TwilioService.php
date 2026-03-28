<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Twilio\Rest\Client;

class TwilioService
{
    protected Client $client;

    public function __construct()
    {
        // ← Read config directly here, no injection needed
        $this->client = new Client(
            config('services.twilio.sid'),
            config('services.twilio.token')
        );
    }

    public function sendSms(string $to, string $message): bool
    {
        try {
            $this->client->messages->create($to, [
                'from' => config('services.twilio.from'),
                'body' => $message,
            ]);

            Log::info('SMS sent', ['to' => $to]);
            return true;

        } catch (\Exception $e) {
            Log::error('SMS failed', [
                'to'    => $to,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }
/*
    public function sendWhatsApp(string $to, string $message): bool
    {
        try {
            $this->client->messages->create("whatsapp:{$to}", [
                'from' => config('services.twilio.whatsapp_from'),
                'body' => $message,
            ]);

            Log::info('WhatsApp sent', ['to' => $to]);
            return true;

        } catch (\Exception $e) {
            Log::error('WhatsApp failed', [
                'to'    => $to,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }
*/
}