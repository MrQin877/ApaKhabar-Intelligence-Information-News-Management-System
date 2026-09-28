<?php

namespace App\Services\News;

use App\Services\CloudinaryService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class MetaConnections
{
    public function configured(string $platform): bool
    {
        return in_array($platform, ['facebook', 'instagram'], true)
            && (bool) (config('meta.facebook.app_id') && config('meta.facebook.app_secret'));
    }

    public function platforms(int $userId): array
    {
        $platforms = [['id' => 'website', 'name' => 'Website ApaKhabar', 'account' => parse_url(config('app.url'), PHP_URL_HOST), 'status' => 'connected', 'connect_url' => null]];
        foreach (['facebook' => 'Facebook', 'instagram' => 'Instagram'] as $id => $name) {
            $credentials = app(MetaCredentials::class)->forPlatform($id, $userId);
            $platforms[] = [
                'id' => $id, 'name' => $name, 'account' => $credentials['name'],
                'status' => $credentials['status'], 'updated_at' => $credentials['updated_at'],
                'publishable' => $credentials['status'] === 'connected' && ($id !== 'instagram' || app(CloudinaryService::class)->configured()),
                'connect_url' => $this->configured($id) ? route("admin.social.{$id}.start") : null,
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

    public function permissions(string $platform): array
    {
        return $platform === 'instagram'
            ? ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish']
            : ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];
    }

    public function facebookPages(string $token, string $platform = 'facebook'): array
    {
        $stage = 'user_token_validation';
        try {
            $base = 'https://graph.facebook.com/'.config('meta.graph_version');
            $debug = Http::timeout(15)->get($base.'/debug_token', [
                'input_token' => $token,
                'access_token' => config('meta.facebook.app_id').'|'.config('meta.facebook.app_secret'),
            ])->json('data');
            if (! is_array($debug) || ! ($debug['is_valid'] ?? false)
                || (string) ($debug['app_id'] ?? '') !== (string) config('meta.facebook.app_id')
                || array_diff($this->permissions($platform), $debug['scopes'] ?? [])) {
                throw ValidationException::withMessages(['connection' => 'Izin Facebook belum lengkap atau sudah kedaluwarsa. Silakan hubungkan kembali.']);
            }
            $stage = 'user_token_exchange';
            $exchange = Http::timeout(15)->get($base.'/oauth/access_token', [
                'grant_type' => 'fb_exchange_token', 'client_id' => config('meta.facebook.app_id'),
                'client_secret' => config('meta.facebook.app_secret'), 'fb_exchange_token' => $token,
            ]);
            if (! $exchange->successful() || ! $exchange->json('access_token')) {
                throw ValidationException::withMessages(['connection' => 'Token Facebook tidak dapat diperbarui.']);
            }
            $diagnostics = $platform === 'instagram' && config('meta.instagram_discovery_diagnostics');
            if ($diagnostics) {
                $this->identityDiagnostics($base, $exchange->json('access_token'), $token);
            }
            $returnedPages = 0;
            $hasPageIds = false;
            $pages = [];
            $after = null;
            $seenCursors = [];
            do {
                $stage = 'accounts_request';
                $this->oauthDiagnostic('discovery', ['platform' => $platform, 'stage' => $stage]);
                $response = Http::timeout(15)->withToken($exchange->json('access_token'))->get($base.'/me/accounts', [
                    'fields' => 'id,name,access_token,tasks'.($platform === 'instagram' ? ',instagram_business_account{id,username}' : ''), 'limit' => 100,
                    ...($after ? ['after' => $after] : []),
                ]);
                $this->oauthDiagnostic('accounts', ['platform' => $platform, 'http_status' => $response->status(), 'accounts_count' => is_array($response->json('data')) ? count($response->json('data')) : 0]);
                $stage = 'accounts_http_rejected';
                if (! $response->successful()) {
                    throw ValidationException::withMessages(['connection' => 'Daftar Halaman Facebook tidak dapat dimuat.']);
                }
                $returnedPages += count($response->json('data', []));
                foreach ($response->json('data', []) as $diagnosticPage) {
                    $hasPageIds = $hasPageIds || ! empty($diagnosticPage['id']);
                }
                $stage = 'accounts_response_processing';
                $discoveredPages = $response->json('data', []);
                if ($diagnostics) {
                    $secrets = array_filter([
                        $token, $exchange->json('access_token'), config('meta.facebook.app_secret'),
                        config('services.facebook.page_access_token'), config('services.instagram.access_token'),
                        ...array_column($discoveredPages, 'access_token'),
                    ], fn ($value) => is_string($value) && $value !== '');
                    foreach ($discoveredPages as $page) {
                        $instagram = is_array($page['instagram_business_account'] ?? null) ? $page['instagram_business_account'] : [];
                        $tasks = is_array($page['tasks'] ?? null) ? $page['tasks'] : [];
                        $clean = fn ($value) => is_scalar($value)
                            ? str_replace($secrets, '[REDACTED]', (string) $value) : null;
                        $this->discoveryLog('page', [
                            'page_id' => $clean($page['id'] ?? null),
                            'page_name' => $clean($page['name'] ?? null),
                            'tasks' => array_values(array_map($clean, array_filter($tasks, 'is_string'))),
                            'has_page_token' => ! empty($page['access_token']),
                            'has_instagram_business_account' => ! empty($page['instagram_business_account']),
                            'instagram_business_account_id' => $clean($instagram['id'] ?? null),
                            'instagram_username' => $clean($instagram['username'] ?? null),
                            'passes_task_filter' => (bool) array_intersect(['CREATE_CONTENT', 'MANAGE'], array_filter($tasks, 'is_string')),
                            'passes_instagram_filter' => (bool) preg_match('/^\d+$/', (string) ($instagram['id'] ?? '')) && ! empty($instagram['username']),
                        ]);
                    }
                }
                $stage = 'page_filtering';
                foreach ($discoveredPages as $page) {
                    $reason = empty($page['access_token']) ? 'missing_page_token' : (! preg_match('/^\d+$/', (string) ($page['id'] ?? '')) ? 'invalid_page_id' : (! array_intersect(['CREATE_CONTENT', 'MANAGE'], $page['tasks'] ?? []) ? 'task_filter_rejected' : null));
                    if ($reason) {
                        $this->oauthDiagnostic('rejection', ['platform' => $platform, 'reason' => $reason]);
                    }
                    if (! empty($page['access_token']) && preg_match('/^\d+$/', (string) ($page['id'] ?? ''))
                        && (array_intersect(['CREATE_CONTENT', 'MANAGE'], $page['tasks'] ?? []))) {
                        if ($platform === 'instagram') {
                            $instagram = $page['instagram_business_account'] ?? [];
                            if (! preg_match('/^\d+$/', (string) ($instagram['id'] ?? '')) || empty($instagram['username'])) {
                                $this->oauthDiagnostic('rejection', ['platform' => $platform, 'reason' => ! preg_match('/^\d+$/', (string) ($instagram['id'] ?? '')) ? 'missing_or_invalid_instagram_id' : 'missing_instagram_username']);

                                continue;
                            }
                            $page['account_id'] = (string) $instagram['id'];
                            $page['account_name'] = '@'.$instagram['username'];
                        } else {
                            $page['account_id'] = (string) $page['id'];
                            $page['account_name'] = $page['name'];
                        }
                        $pages[(string) $page['id']] = $page;
                    }
                }
                $stage = 'pagination_rejected';
                $next = $response->json('paging.next') ? $response->json('paging.cursors.after') : null;
                if ($next && (isset($seenCursors[$next]) || count($seenCursors) >= 100)) {
                    throw ValidationException::withMessages(['connection' => 'Daftar Halaman tidak dapat diselesaikan.']);
                }
                // Never follow provider URLs containing tokens; only reuse a cursor on our fixed endpoint.
                if ($next) {
                    $seenCursors[$next] = true;
                }
                $after = $next;
            } while ($after);
            if ($diagnostics) {
                $this->discoveryLog('summary', ['zero_pages' => $returnedPages === 0, 'accounts_count' => $returnedPages, 'has_page_ids' => $hasPageIds]);
            }

            $this->oauthDiagnostic('discovery_complete', ['platform' => $platform, 'eligible_count' => count($pages)]);

            return array_values($pages);
        } catch (\Throwable $exception) {
            $this->oauthDiagnostic('rejection', ['platform' => $platform, 'reason' => $stage]);
            throw $exception;
        }
    }

    /** Validate the selected Page credential, never infer its expiry from a user token. */
    public function pageTokenExpiry(string $token, string $pageId): ?string
    {
        try {
            $response = Http::withoutRedirecting()->timeout(15)
                ->withToken(config('meta.facebook.app_id').'|'.config('meta.facebook.app_secret'))
                ->get('https://graph.facebook.com/'.config('meta.graph_version').'/debug_token', ['input_token' => $token]);
            $data = $response->json('data');
            $this->oauthDiagnostic('selected_token', ['http_status' => $response->status(), 'valid' => is_array($data) && ($data['is_valid'] ?? false) === true]);
            if ($response->successful() && is_array($data)
                && ($data['is_valid'] ?? false) === true
                && (string) ($data['app_id'] ?? '') === (string) config('meta.facebook.app_id')
                && ($data['type'] ?? null) === 'PAGE'
                && (string) ($data['profile_id'] ?? '') === $pageId
                && isset($data['expires_at']) && is_int($data['expires_at'])
                && ($data['expires_at'] === 0 || $data['expires_at'] > now()->timestamp)) {
                return $data['expires_at'] === 0 ? null : date('Y-m-d H:i:s', $data['expires_at']);
            }
        } catch (\Throwable) {
            // Provider exceptions may include credential-bearing request URLs.
        }

        $this->oauthDiagnostic('rejection', ['reason' => 'selected_page_token_validation_failed']);
        throw ValidationException::withMessages(['connection' => 'Token Halaman tidak dapat divalidasi. Silakan hubungkan kembali.']);
    }

    private function identityDiagnostics(string $base, string $token, string $shortToken): void
    {
        $secrets = array_filter([$token, $shortToken, config('meta.facebook.app_secret'),
            config('services.facebook.page_access_token'), config('services.instagram.access_token')],
            fn ($value) => is_string($value) && $value !== '');
        $clean = fn ($value) => is_scalar($value) ? str_replace($secrets, '[REDACTED]', (string) $value) : null;
        try {
            $profile = Http::withoutRedirecting()->connectTimeout(3)->timeout(8)->withToken($token)
                ->get($base.'/me', ['fields' => 'id,name']);
            $this->discoveryLog('user', [
                'available' => $profile->successful(),
                'id' => $profile->successful() ? $clean($profile->json('id')) : null,
                'name' => $profile->successful() ? $clean($profile->json('name')) : null,
            ]);
        } catch (\Throwable) {
            $this->discoveryLog('user', ['available' => false, 'id' => null, 'name' => null]);
        }

        $permissions = [];
        $complete = false;
        try {
            $after = null;
            $seen = [];
            do {
                $response = Http::withoutRedirecting()->connectTimeout(3)->timeout(8)->withToken($token)
                    ->get($base.'/me/permissions', ['limit' => 100, ...($after ? ['after' => $after] : [])]);
                if (! $response->successful() || ! is_array($response->json('data'))) {
                    break;
                }
                foreach ($response->json('data') as $permission) {
                    $permissions[] = ['permission' => $clean($permission['permission'] ?? null), 'status' => $clean($permission['status'] ?? null)];
                }
                if (! $response->json('paging.next')) {
                    $complete = true;
                    break;
                }
                $after = $response->json('paging.cursors.after');
                if (! is_string($after) || $after === '' || isset($seen[$after]) || count($seen) >= 10) {
                    break;
                }
                $seen[$after] = true;
            } while ($after);
        } catch (\Throwable) {
            // Report unavailable/partial diagnostics without logging transport or provider errors.
        }
        $granted = [];
        foreach ($this->permissions('instagram') as $name) {
            $granted[$name] = $complete ? collect($permissions)->contains(fn ($item) => $item['permission'] === $name && $item['status'] === 'granted') : null;
        }
        $this->discoveryLog('permissions', ['complete' => $complete, 'permissions' => $permissions, 'granted' => $granted]);
    }

    /** Only pass fixed enums, booleans and counts; never provider payloads or exceptions. */
    public function oauthDiagnostic(string $event, array $safeContext): void
    {
        if (! config('meta.instagram_discovery_diagnostics')) {
            return;
        }
        try {
            Log::channel('single')->info('meta.oauth.'.$event, $safeContext);
        } catch (\Throwable) {
            // Diagnostics must not affect OAuth decisions.
        }
    }

    private function discoveryLog(string $event, array $safeContext): void
    {
        try {
            Log::channel('single')->info('meta.instagram.discovery.'.$event, $safeContext);
        } catch (\Throwable) {
            // Temporary diagnostics must never prevent connection discovery.
        }
    }
}
