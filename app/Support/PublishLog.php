<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

class PublishLog
{
    public static function write(string $stage, array $context = [], string $level = 'info'): void
    {
        $secrets = [];
        $collect = function ($values) use (&$collect, &$secrets) {
            foreach ((array) $values as $key => $value) {
                if (is_array($value)) {
                    $collect($value);
                } elseif (preg_match('/token|secret|password|app_key/i', (string) $key) && is_string($value) && $value !== '') {
                    $secrets[] = $value;
                }
            }
        };
        $collect(config('services'));
        $collect(config('meta'));
        $collect(config('database.connections'));
        $collect(['app_key' => config('app.key')]);
        $clean = function ($value, $key = '') use (&$clean, $secrets) {
            if (preg_match('/token|secret|password|authorization|cookie|credential/i', (string) $key)) {
                return '[REDACTED]';
            }
            if (is_array($value)) {
                foreach ($value as $k => $v) {
                    $value[$k] = $clean($v, $k);
                }

                return $value;
            }
            if (is_string($value)) {
                $value = str_replace($secrets, '[REDACTED]', $value);
                $value = preg_replace('/Bearer\s+[^\s",}]+/i', 'Bearer [REDACTED]', $value);
                $value = preg_replace('/(access_token|appsecret_proof|client_secret|password|authorization)(["\s:=]+)[^\s&,"}]+/i', '$1$2[REDACTED]', $value);
                $value = preg_replace('~(https?://)[^/\s@]+:[^/\s@]+@~', '$1[REDACTED]@', $value);
                $value = preg_replace('~(https?://[^\s?"<>]+)\?[^\s"<>]*~', '$1?[REDACTED]', $value);
            }

            return $value;
        };
        Log::log($level, 'manual_publish.'.$stage, $clean($context));
    }
}
