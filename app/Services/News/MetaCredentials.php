<?php

namespace App\Services\News;

use App\Models\SocialConnection;

class MetaCredentials
{
    /** A saved (including disconnected) record takes precedence over legacy configuration. */
    public function forPlatform(string $platform, ?int $userId = null): array
    {
        $userId ??= auth()->id();
        $connection = $userId ? SocialConnection::where('user_id', $userId)->where('platform', $platform)->first() : null;
        if ($connection) {
            return [
                'auth_source' => $connection->authSource(), 'graph_host' => $connection->graphHost(),
                'id' => $connection->account_id, 'token' => $connection->isConnected() ? $connection->access_token : null,
                'name' => $connection->account_name ?: null, 'updated_at' => $connection->updated_at?->toIso8601String(),
                'status' => $connection->isConnected() ? 'connected' : ($connection->access_token ? 'expired' : 'disconnected'),
            ];
        }
        $id = config($platform === 'facebook' ? 'services.facebook.page_id' : 'services.instagram.user_id');
        $token = config($platform === 'facebook' ? 'services.facebook.page_access_token' : 'services.instagram.access_token');
        $ready = preg_match('/^\d+$/', (string) $id) && trim((string) $token) !== '';

        return ['auth_source' => $platform === 'instagram' ? 'instagram_login' : 'facebook_login',
            'graph_host' => $platform === 'instagram' ? 'graph.instagram.com' : 'graph.facebook.com',
            'id' => $id, 'token' => $ready ? $token : null, 'name' => null,
            'updated_at' => null, 'status' => $ready ? 'connected' : 'disconnected'];
    }
}
