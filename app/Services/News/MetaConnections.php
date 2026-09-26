<?php

namespace App\Services\News;

use App\Models\SocialConnection;
use App\Services\FacebookPublishingService;
use App\Services\InstagramService;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class MetaConnections
{
    public function configured(string $platform): bool
    {
        return (bool) (config("meta.{$platform}.app_id") && config("meta.{$platform}.app_secret")
            && ($platform !== 'instagram' || config('meta.instagram.redirect_uri')));
    }

    public function platforms(int $userId): array
    {
        $connections = SocialConnection::where('user_id', $userId)->get()->keyBy('platform');
        $platforms = [['id' => 'website', 'name' => 'Website ApaKhabar', 'account' => parse_url(config('app.url'), PHP_URL_HOST), 'status' => 'connected', 'connect_url' => null]];
        foreach (['facebook' => 'Facebook', 'instagram' => 'Instagram'] as $id => $name) {
            if ($id === 'instagram') {
                $ready = app(InstagramService::class)->configured();
                $platforms[] = ['id' => $id, 'name' => $name, 'account' => $ready ? 'ApaKhabar' : null, 'status' => $ready ? 'connected' : 'disconnected', 'connect_url' => $this->configured($id) ? route('admin.social.instagram.start') : null];

                continue;
            }
            if ($id === 'facebook' && app(FacebookPublishingService::class)->configured()) {
                $platforms[] = ['id' => $id, 'name' => $name, 'account' => 'ApaKhabar', 'status' => 'connected', 'connect_url' => null];

                continue;
            }
            $connection = $connections->get($id);
            $platforms[] = [
                'id' => $id, 'name' => $name, 'account' => $connection?->account_name,
                'status' => $connection ? ($connection->isConnected() ? 'connected' : 'expired') : 'disconnected',
                'connect_url' => $id === 'instagram' && $this->configured($id) ? route('admin.social.instagram.start') : null,
            ];
        }

        return $platforms;
    }

    public function publicConfig(): array
    {
        return [
            'facebookAppId' => $this->configured('facebook') ? config('meta.facebook.app_id') : null,
            'graphVersion' => config('meta.graph_version'),
            'instagramConfigured' => $this->configured('instagram'),
        ];
    }

    public function facebookPages(string $token): array
    {
        $base = 'https://graph.facebook.com/'.config('meta.graph_version');
        $debug = Http::timeout(15)->get($base.'/debug_token', [
            'input_token' => $token,
            'access_token' => config('meta.facebook.app_id').'|'.config('meta.facebook.app_secret'),
        ])->json('data');
        if (! is_array($debug) || ! ($debug['is_valid'] ?? false)
            || (string) ($debug['app_id'] ?? '') !== (string) config('meta.facebook.app_id')
            || array_diff(['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'], $debug['scopes'] ?? [])) {
            throw ValidationException::withMessages(['connection' => 'Izin Facebook belum lengkap atau sudah kedaluwarsa. Silakan hubungkan kembali.']);
        }
        $exchange = Http::timeout(15)->get($base.'/oauth/access_token', [
            'grant_type' => 'fb_exchange_token', 'client_id' => config('meta.facebook.app_id'),
            'client_secret' => config('meta.facebook.app_secret'), 'fb_exchange_token' => $token,
        ]);
        if (! $exchange->successful() || ! $exchange->json('access_token')) {
            throw ValidationException::withMessages(['connection' => 'Token Facebook tidak dapat diperbarui.']);
        }
        $response = Http::timeout(15)->withToken($exchange->json('access_token'))->get($base.'/me/accounts', [
            'fields' => 'id,name,access_token,tasks', 'limit' => 100,
        ]);
        if (! $response->successful()) {
            throw ValidationException::withMessages(['connection' => 'Daftar Halaman Facebook tidak dapat dimuat.']);
        }
        // Page tokens stay on the server. Ask the author to choose explicitly.
        $pages = array_values(array_filter($response->json('data', []), fn ($page) => ! empty($page['access_token']) && array_intersect(['CREATE_CONTENT', 'MANAGE'], $page['tasks'] ?? [])
        ));
        $expiry = now()->addSeconds((int) $exchange->json('expires_in', 3600))->timestamp;
        if (($debug['data_access_expires_at'] ?? 0) > 0) {
            $expiry = min($expiry, (int) $debug['data_access_expires_at']);
        }

        return array_map(fn ($page) => [...$page, 'expires_at' => date('Y-m-d H:i:s', $expiry)], $pages);
    }

    public function saveInstagram(int $userId, string $code): void
    {
        $short = Http::asForm()->timeout(15)->post('https://api.instagram.com/oauth/access_token', [
            'client_id' => config('meta.instagram.app_id'), 'client_secret' => config('meta.instagram.app_secret'),
            'grant_type' => 'authorization_code', 'redirect_uri' => config('meta.instagram.redirect_uri'), 'code' => $code,
        ]);
        if (! $short->successful() || ! $short->json('access_token')) {
            throw ValidationException::withMessages(['connection' => 'Otorisasi Instagram tidak berhasil.']);
        }
        $permissions = $short->json('permissions', []);
        $permissions = is_array($permissions) ? $permissions : explode(',', $permissions);
        if (array_diff(['instagram_business_basic', 'instagram_business_content_publish'], $permissions)) {
            throw ValidationException::withMessages(['connection' => 'Izin akun dan penerbitan Instagram belum lengkap.']);
        }
        $long = Http::timeout(15)->get('https://graph.instagram.com/access_token', [
            'grant_type' => 'ig_exchange_token', 'client_secret' => config('meta.instagram.app_secret'),
            'access_token' => $short->json('access_token'),
        ]);
        $token = $long->json('access_token');
        if (! $long->successful() || ! $token) {
            throw ValidationException::withMessages(['connection' => 'Token Instagram tidak dapat diperbarui.']);
        }
        $profile = Http::timeout(15)->withToken($token)->get('https://graph.instagram.com/'.config('meta.graph_version').'/me', [
            'fields' => 'user_id,username',
        ]);
        if (! $profile->successful() || ! $profile->json('user_id') || ! $profile->json('username')) {
            throw ValidationException::withMessages(['connection' => 'Akun profesional Instagram tidak dapat diverifikasi.']);
        }
        SocialConnection::updateOrCreate(['user_id' => $userId, 'platform' => 'instagram'], [
            'account_id' => $profile->json('user_id'), 'account_name' => '@'.$profile->json('username'),
            'access_token' => $token, 'expires_at' => now()->addSeconds((int) $long->json('expires_in', 3600)),
            'invalidated_at' => null,
        ]);
    }
}
