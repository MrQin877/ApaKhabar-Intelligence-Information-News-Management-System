<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SocialConnection;
use App\Services\News\MetaConnections;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Inertia;

class MetaConnectionController extends Controller
{
    public function status(Request $request, MetaConnections $meta)
    {
        foreach (SocialConnection::where('user_id', $request->user()->getKey())->get() as $connection) {
            if (! $connection->isConnected()) {
                continue;
            }
            try {
                $host = $connection->graphHost();
                $response = Http::timeout(8)->withToken($connection->access_token)->get(
                    'https://'.$host.'/'.config('meta.graph_version').'/'.$connection->account_id, ['fields' => 'id']
                );
                if (in_array((int) $response->json('error.code'), [190, 102], true)) {
                    // A probe of an old token must not invalidate a concurrent successful reconnect.
                    SocialConnection::whereKey($connection->getKey())
                        ->where('access_token', $connection->getRawOriginal('access_token'))
                        ->update(['invalidated_at' => now()]);
                }
            } catch (\Throwable) {
                // A temporary network failure is not proof that consent expired.
            }
        }

        return response()->json(['platforms' => $meta->platforms($request->user()->getKey())])->header('Cache-Control', 'no-store');
    }

    public function integration(Request $request, MetaConnections $meta)
    {
        $pending = $request->session()->get('meta_selection');
        $encrypted = $pending ? Cache::get($this->pagesKey($request, $pending)) : null;
        $selection = $encrypted ? json_decode(Crypt::decryptString($encrypted), true) : null;

        return Inertia::render('settings/integration', [
            'platforms' => array_slice($meta->platforms($request->user()->getKey()), 1),
            'connectionMessage' => $request->session()->get('connection_message'),
            'connectionPlatform' => $request->session()->get('connection_platform'),
            'selection' => $selection ? [
                'ticket' => $pending, 'platform' => $selection['platform'],
                'pages' => array_map(fn ($page) => [
                    'id' => $page['id'], 'name' => $page['name'],
                    'account_name' => $page['account_name'],
                ], $selection['pages']),
            ] : null,
        ])->toResponse($request)->header('Cache-Control', 'no-store')->header('Referrer-Policy', 'no-referrer');
    }

    private function pagesKey(Request $request, string $ticket): string
    {
        return 'meta-accounts:'.$request->user()->getKey().':'.$ticket;
    }

    private function clearSelection(Request $request): void
    {
        if ($ticket = $request->session()->pull('meta_selection')) {
            Cache::forget($this->pagesKey($request, $ticket));
        }
    }

    public function cancelSelection(Request $request)
    {
        $this->clearSelection($request);

        return response()->json(['success' => true]);
    }

    public function facebookStart(Request $request, MetaConnections $meta)
    {
        return $this->start($request, $meta, 'facebook');
    }

    public function instagramStart(Request $request, MetaConnections $meta)
    {
        return $this->start($request, $meta, 'instagram');
    }

    private function start(Request $request, MetaConnections $meta, string $platform)
    {
        abort_unless($meta->configured($platform), 503, 'Login Meta belum dikonfigurasi.');
        if ($request->boolean('insights')) {
            abort_unless($request->user()->isAdmin(), 403);
        }
        // Establish authorization on the callback host so its browser session
        // cookie is available when Meta returns (localhost != 127.0.0.1).
        $callback = parse_url(config('meta.facebook.redirect_uri') ?: route('admin.social.facebook.callback'));
        if (isset($callback['host']) && strcasecmp($callback['host'], $request->getHost()) !== 0) {
            $origin = ($callback['scheme'] ?? 'https').'://'.$callback['host']
                .(isset($callback['port']) ? ':'.$callback['port'] : '');

            return redirect()->away($origin.'/admin/social/'.$platform.'/connect'
                .($request->boolean('insights') ? '?insights=1' : ''))
                ->header('Cache-Control', 'no-store');
        }
        $this->clearSelection($request);
        $state = Str::random(64);
        Cache::put($this->oauthKey($request), [
            'platform' => $platform,
            'state' => $state, 'user_id' => $request->user()->getKey(), 'expires' => now()->addMinutes(10)->timestamp,
        ], now()->addMinutes(10));

        $meta->oauthDiagnostic('start', [...$this->oauthContext($request), 'callback_reached' => false, 'intended_platform' => $platform, 'config_id_source' => config("meta.login_config_ids.{$platform}") ? ($platform === 'facebook' ? 'FACEBOOK_LOGIN_CONFIG_ID' : 'INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID') : 'scope_parameter']);

        return redirect()->away('https://www.facebook.com/'.config('meta.graph_version').'/dialog/oauth?'.http_build_query([
            'client_id' => config('meta.facebook.app_id'),
            'redirect_uri' => config('meta.facebook.redirect_uri') ?: route('admin.social.facebook.callback'),
            'response_type' => 'code',
            ...(config("meta.login_config_ids.{$platform}")
                ? ['config_id' => config("meta.login_config_ids.{$platform}")]
                : ['scope' => implode(',', [...$meta->permissions($platform), ...($request->boolean('insights') ? [$platform === 'instagram' ? 'instagram_manage_insights' : 'read_insights'] : [])])]),
            'auth_type' => 'rerequest', 'state' => $state,
        ]));
    }

    public function facebookCallback(Request $request, MetaConnections $meta)
    {
        $pending = Cache::get($this->oauthKey($request));
        $intended = in_array($pending['platform'] ?? null, ['facebook', 'instagram'], true) ? $pending['platform'] : 'unknown';
        $error = $request->query('error');
        $meta->oauthDiagnostic('callback', [
            ...$this->oauthContext($request),
            'callback_reached' => true, 'has_code' => $request->has('code'), 'has_error' => $request->has('error'),
            'error_name' => in_array($error, ['access_denied', 'server_error', 'temporarily_unavailable', 'invalid_request', 'unauthorized_client', 'unsupported_response_type', 'invalid_scope'], true) ? $error : ($request->has('error') ? 'other' : null),
            'state_present' => $request->has('state'),
            'state_matches_session' => is_string($pending['state'] ?? null) && is_string($request->query('state')) && hash_equals($pending['state'], $request->query('state')),
            'intended_platform' => $intended,
            'config_id_source' => config("meta.login_config_ids.{$intended}") ? ($intended === 'facebook' ? 'FACEBOOK_LOGIN_CONFIG_ID' : 'INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID') : 'scope_parameter',
            'session_user_matches' => ($pending['user_id'] ?? null) === $request->user()->getKey(),
            'session_unexpired' => ($pending['expires'] ?? 0) > now()->timestamp,
        ]);
        $platform = $this->validateState($request);
        $message = 'Otorisasi '.ucfirst($platform).' dibatalkan atau gagal. Koneksi sebelumnya tidak berubah.';
        if (! $request->has('error') && is_string($request->query('code'))) {
            $stage = 'code_exchange_request';
            try {
                $short = Http::asForm()->timeout(15)->post('https://graph.facebook.com/'.config('meta.graph_version').'/oauth/access_token', [
                    'client_id' => config('meta.facebook.app_id'), 'client_secret' => config('meta.facebook.app_secret'),
                    'redirect_uri' => config('meta.facebook.redirect_uri') ?: route('admin.social.facebook.callback'),
                    'code' => $request->query('code'),
                ]);
                $meta->oauthDiagnostic('code_exchange', ['platform' => $platform, 'http_status' => $short->status(), 'has_token' => (bool) $short->json('access_token')]);
                $stage = 'page_discovery';
                if ($short->successful() && $short->json('access_token')) {
                    $pages = $meta->facebookPages($short->json('access_token'), $platform);
                    if ($pages) {
                        $stage = 'selection_cache_write';
                        $ticket = Str::random(48);
                        Cache::put($this->pagesKey($request, $ticket), Crypt::encryptString(json_encode(['platform' => $platform, 'pages' => $pages])), now()->addMinutes(10));
                        $request->session()->put('meta_selection', $ticket);
                        $meta->oauthDiagnostic('selection_ready', ['platform' => $platform, 'accounts_count' => count($pages)]);
                        $message = $platform === 'instagram' ? 'Pilih akun Instagram untuk menyelesaikan koneksi.' : 'Pilih Halaman Facebook untuk menyelesaikan koneksi.';
                    } else {
                        $message = 'Tidak ada Halaman Facebook yang tersedia untuk akun ini. Koneksi sebelumnya tidak berubah.';
                    }
                } else {
                    $meta->oauthDiagnostic('callback_rejected', ['platform' => $platform, 'reason' => $short->successful() ? 'code_exchange_missing_token' : 'code_exchange_http_rejected']);
                }
            } catch (\Throwable) {
                $meta->oauthDiagnostic('callback_rejected', ['platform' => $platform, 'reason' => $stage]);
            }
        }

        return redirect()->route('integration.edit')->with('connection_message', $message)
            ->with('connection_platform', $platform)
            ->header('Cache-Control', 'no-store')->header('Referrer-Policy', 'no-referrer');
    }

    private function oauthContext(Request $request): array
    {
        return [
            'request_origin' => $request->getSchemeAndHttpHost(),
            'session_driver' => config('session.driver'),
            'cache_store' => config('cache.default'),
            // Correlation only; never log cookies, session IDs, codes or state.
            'browser_fingerprint' => substr(hash_hmac('sha256', $request->session()->getId(), config('app.key')), 0, 16),
            'pending_authorization' => Cache::has($this->oauthKey($request)),
        ];
    }

    private function oauthKey(Request $request): string
    {
        // Bind the authorization to both the current browser session and user.
        return 'meta-oauth:'.hash('sha256', $request->session()->getId().':'.$request->user()->getKey());
    }

    private function validateState(Request $request): string
    {
        // The route session lock serializes validation and consumption. A separate
        // cache record cannot be overwritten by unrelated session responses.
        $pending = Cache::pull($this->oauthKey($request));
        abort_unless(is_array($pending) && ($pending['user_id'] ?? null) === $request->user()->getKey()
            && in_array($pending['platform'] ?? null, ['facebook', 'instagram'], true)
            && ($pending['expires'] ?? 0) > now()->timestamp
            && is_string($request->query('state')) && hash_equals($pending['state'], $request->query('state')), 419);

        return $pending['platform'];
    }

    public function disconnect(Request $request, MetaConnections $meta, string $platform)
    {
        abort_unless(in_array($platform, ['facebook', 'instagram'], true), 404);
        $request->validate(['confirmed' => ['required', 'accepted']]);
        Cache::forget($this->oauthKey($request));
        $request->session()->forget('meta_oauth');
        $this->clearSelection($request);
        // Keep a tombstone so legacy environment credentials cannot reactivate publishing.
        SocialConnection::updateOrCreate(['user_id' => $request->user()->getKey(), 'platform' => $platform], [
            'account_id' => '', 'account_name' => '', 'access_token' => '',
            'expires_at' => null, 'invalidated_at' => now(),
        ]);

        return response()->json(['platforms' => $meta->platforms($request->user()->getKey())])->header('Cache-Control', 'no-store');
    }

    public function chooseAccount(Request $request, MetaConnections $meta)
    {
        $meta->oauthDiagnostic('selection', ['stage' => 'configuration_check']);
        abort_unless($meta->configured('facebook'), 503, 'Facebook belum dikonfigurasi.');
        $meta->oauthDiagnostic('selection', ['stage' => 'selection_input_validation']);
        $data = $request->validate(['ticket' => ['required', 'string', 'size:48'], 'page_id' => ['required', 'string']]);
        $key = 'meta-accounts:'.$request->user()->getKey().':'.$data['ticket'];
        $meta->oauthDiagnostic('selection', ['stage' => 'selection_ticket_check']);
        abort_unless($request->session()->get('meta_selection') === $data['ticket'], 422, 'Pilihan Halaman kedaluwarsa.');
        $encrypted = Cache::get($key);
        $meta->oauthDiagnostic('selection', ['stage' => 'selection_cache_check']);
        abort_unless($encrypted, 422, 'Pilihan Halaman kedaluwarsa. Hubungkan kembali.');
        $meta->oauthDiagnostic('selection', ['stage' => 'selection_decryption']);
        $selection = json_decode(Crypt::decryptString($encrypted), true);
        $platform = $selection['platform'] ?? null;
        $meta->oauthDiagnostic('selection', ['stage' => 'selection_platform_check']);
        abort_unless(in_array($platform, ['facebook', 'instagram'], true), 422);
        $page = collect($selection['pages'])->firstWhere('id', $data['page_id']);
        $meta->oauthDiagnostic('selection', ['stage' => 'selected_page_check']);
        abort_unless($page, 422, 'Halaman tidak tersedia atau izin kedaluwarsa.');
        $meta->oauthDiagnostic('selection', ['stage' => 'selected_token_validation']);
        $expiresAt = $meta->pageTokenExpiry($page['access_token'], (string) $page['id']);
        SocialConnection::updateOrCreate(['user_id' => $request->user()->getKey(), 'platform' => $platform], [
            'account_id' => $page['account_id'], 'account_name' => $page['account_name'], 'access_token' => $page['access_token'],
            'auth_source' => 'facebook_login',
            'expires_at' => $expiresAt, 'invalidated_at' => null,
        ]);
        $meta->oauthDiagnostic('selection', ['stage' => 'connection_saved', 'platform' => $platform]);
        Cache::forget($key);
        $request->session()->forget('meta_selection');

        return response()->json(['platforms' => $meta->platforms($request->user()->getKey())])->header('Cache-Control', 'no-store');
    }

    /** Old in-flight Instagram Login callbacks must restart through Meta; stored tokens still work. */
    public function instagramCallback(Request $request)
    {
        $request->session()->forget('instagram_oauth');

        return redirect()->route('integration.edit')->with('connection_message',
            'Silakan hubungkan kembali Instagram melalui Meta untuk melanjutkan.')
            ->with('connection_platform', 'instagram')
            ->header('Cache-Control', 'no-store')->header('Referrer-Policy', 'no-referrer');
    }
}
