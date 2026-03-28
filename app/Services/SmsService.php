<?php

namespace App\Services;

use bulk360\client;
use Illuminate\Support\Facades\Log;

class SmsService
{
    protected client $client;

    public function __construct()
    {
        $this->client = new client(
            config('services.bulk360.app_key'),
            config('services.bulk360.app_secret')
        );
    }

    public function sendSms(string $to, string $message): bool
    {
        try {
            $to = ltrim($to, '+');

            $response = $this->client->send([
                'from' => config('services.bulk360.from'),
                'to'   => $to,
                'text' => $message,
            ]);

            Log::info('SMS sent via Bulk360', [
                'to'       => $to,
                'response' => $response,
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error('SMS failed via Bulk360', [
                'to'    => $to,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }
}