<?php

namespace App\Services;

use bulk360\client;
use Illuminate\Support\Facades\Http;
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

    /** Mobile delivery reports provider rejection and has a bounded timeout. */
    public function sendMobileOtp(string $to, string $message): bool
    {
        if (! config('services.bulk360.app_key') || ! config('services.bulk360.app_secret')) {
            return false;
        }

        try {
            // Same Bulk360 gateway/configuration as sendSms; leave the web path unchanged.
            $response = Http::connectTimeout(5)->timeout(15)->get('https://sms.360.my/gw/bulk360/v3_0/send.php', [
                'user' => config('services.bulk360.app_key'),
                'pass' => config('services.bulk360.app_secret'),
                'from' => config('services.bulk360.from'),
                'to' => ltrim($to, '+'),
                'text' => $message,
            ]);

            return $response->successful() && (int) $response->json('code') === 200;
        } catch (\Throwable) {
            // Do not log URLs/exception messages containing provider credentials or OTPs.
            Log::warning('Mobile OTP provider request failed.');

            return false;
        }
    }


    public function sendWhatsAppGroup(string $groupId, string $message): bool
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . config('services.whapi.token'),
                'Content-Type'  => 'application/json',
            ])->post('https://gate.whapi.cloud/messages/text', [
                'to'   => $groupId,
                'body' => $message,
            ]);

            if ($response->successful()) {
                Log::info('WhatsApp group message sent', [
                    'group'    => $groupId,
                    'response' => $response->json(),
                ]);
                return true;
            }

            Log::error('WhatsApp group message failed', [
                'group'    => $groupId,
                'response' => $response->json(),
            ]);
            return false;

        } catch (\Exception $e) {
            Log::error('WhatsApp group message failed', [
                'group' => $groupId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }
}