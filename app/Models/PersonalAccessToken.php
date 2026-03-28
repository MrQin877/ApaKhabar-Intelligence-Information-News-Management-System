<?php

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;
use MongoDB\Laravel\Eloquent\DocumentModel;

class PersonalAccessToken extends SanctumPersonalAccessToken
{
    use DocumentModel;

    protected $connection = 'mongodb';
    protected $collection = 'personal_access_tokens';

    protected $casts = [
        'abilities'    => 'json',
        'last_used_at' => 'datetime',
        'expires_at'   => 'datetime',
    ];

    public static function findToken($token)
    {
        \Log::info('findToken called with: ' . $token);

        if (!str_contains($token, '|')) {
            return static::where('token', hash('sha256', $token))->first();
        }

        [$id, $plainText] = explode('|', $token, 2);

        \Log::info('Looking for token with id: ' . $id);

        $instance = static::where('_id', $id)->first();

        \Log::info('Found instance: ' . ($instance ? 'YES' : 'NO'));

        if ($instance) {
            $valid = hash_equals($instance->token, hash('sha256', $plainText));
            \Log::info('Token valid: ' . ($valid ? 'YES' : 'NO'));
            return $valid ? $instance : null;
        }

        return null;
    }

    public function tokenable()
    {
        return $this->morphTo('tokenable', 'tokenable_type', 'tokenable_id');
    }
}