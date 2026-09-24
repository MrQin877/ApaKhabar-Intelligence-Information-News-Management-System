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
use Illuminate\Validation\ValidationException;

class MetaConnectionController extends Controller
{
    public function status(Request $request, MetaConnections $meta)
    {
        foreach (SocialConnection::where('user_id', $request->user()->getKey())->get() as $connection) {
            if (! $connection->isConnected()) {
                continue;
            }
            try {
                $host = $connection->platform === 'facebook' ? 'graph.facebook.com' : 'graph.instagram.com';
                $response = Http::timeout(8)->withToken($connection->access_token)->get(
                    'https://'.$host.'/'.config('meta.graph_version').'/'.$connection->account_id, ['fields' => 'id']
                );
                if ((int) $response->json('error.code') === 190) {
                    $connection->update(['invalidated_at' => now()]);
                }
            } catch (\Throwable) {
                // A temporary network failure is not proof that consent expired.
            }
        }

        return response()->json(['platforms' => $meta->platforms($request->user()->getKey())])->header('Cache-Control', 'no-store');
    }

    public function facebookAuthorize(Request $request, MetaConnections $meta)
    {
        abort_unless($meta->configured('facebook'), 503, 'Facebook belum dikonfigurasi.');
        $data = $request->validate(['access_token' => ['required', 'string', 'max:4096']]);
        try {
            $pages = $meta->facebookPages($data['access_token']);
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (\Throwable) {
            return response()->json(['message' => 'Facebook tidak dapat dihubungi. Silakan coba lagi.'], 502);
        }
        if (! $pages) {
            throw ValidationException::withMessages(['connection' => 'Tidak ada Halaman dengan izin menerbitkan. Hubungkan akun yang mengelola Halaman Facebook.']);
        }
        $ticket = Str::random(48);
        Cache::put('facebook-pages:'.$request->user()->getKey().':'.$ticket, Crypt::encryptString(json_encode($pages)), now()->addMinutes(10));

        return response()->json(['ticket' => $ticket, 'pages' => array_map(fn ($page) => ['id' => $page['id'], 'name' => $page['name']], $pages)])
            ->header('Cache-Control', 'no-store');
    }

    public function facebookChoose(Request $request, MetaConnections $meta)
    {
        abort_unless($meta->configured('facebook'), 503, 'Facebook belum dikonfigurasi.');
        $data = $request->validate(['ticket' => ['required', 'string', 'size:48'], 'page_id' => ['required', 'string']]);
        $key = 'facebook-pages:'.$request->user()->getKey().':'.$data['ticket'];
        $encrypted = Cache::get($key);
        abort_unless($encrypted, 422, 'Pilihan Halaman kedaluwarsa. Hubungkan kembali.');
        $page = collect(json_decode(Crypt::decryptString($encrypted), true))->firstWhere('id', $data['page_id']);
        abort_unless($page, 422, 'Halaman tidak tersedia untuk akun ini.');
        SocialConnection::updateOrCreate(['user_id' => $request->user()->getKey(), 'platform' => 'facebook'], [
            'account_id' => $page['id'], 'account_name' => $page['name'], 'access_token' => $page['access_token'],
            'expires_at' => $page['expires_at'], 'invalidated_at' => null,
        ]);
        Cache::forget($key);

        return response()->json(['platforms' => $meta->platforms($request->user()->getKey())]);
    }

    public function instagramStart(Request $request, MetaConnections $meta)
    {
        abort_unless($meta->configured('instagram'), 503, 'Instagram belum dikonfigurasi.');
        $state = Str::random(64);
        $request->session()->put('instagram_oauth', [
            'state' => $state, 'user_id' => $request->user()->getKey(), 'expires' => now()->addMinutes(10)->timestamp,
        ]);

        return redirect()->away('https://www.instagram.com/oauth/authorize?'.http_build_query([
            'client_id' => config('meta.instagram.app_id'), 'redirect_uri' => config('meta.instagram.redirect_uri'),
            'response_type' => 'code', 'scope' => 'instagram_business_basic,instagram_business_content_publish',
            'state' => $state,
        ]));
    }

    public function instagramCallback(Request $request, MetaConnections $meta)
    {
        abort_unless($meta->configured('instagram'), 503, 'Instagram belum dikonfigurasi.');
        $pending = $request->session()->pull('instagram_oauth');
        abort_unless(is_array($pending) && ($pending['user_id'] ?? null) === $request->user()->getKey()
            && ($pending['expires'] ?? 0) > now()->timestamp
            && is_string($request->query('state')) && hash_equals($pending['state'], $request->query('state')), 419);
        $success = false;
        if (! $request->has('error') && is_string($request->query('code'))) {
            try {
                $meta->saveInstagram($request->user()->getKey(), $request->query('code'));
                $success = true;
            } catch (\Throwable) {
                // Do not put OAuth codes or tokens into logs/flash/session error bags.
            }
        }

        return response()->view('social-auth-result', ['success' => $success])
            ->header('Cache-Control', 'no-store')->header('Referrer-Policy', 'no-referrer');
    }
}
