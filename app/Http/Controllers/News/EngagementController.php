<?php

namespace App\Http\Controllers\News;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\News;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class EngagementController extends Controller
{
    public function context(Request $request, string $id)
    {
        News::active()->findOrFail($id);
        $anonymous = $request->cookie('news_visitor');
        if (! is_string($anonymous) || ! Str::isUuid($anonymous)) {
            $anonymous = (string) Str::uuid();
        }
        $viewer = $request->user() ? 'user:'.$request->user()->getKey()
            : 'guest:'.hash_hmac('sha256', $anonymous, config('app.key'));
        $token = Crypt::encryptString(json_encode([
            'news' => $id, 'viewer' => $viewer, 'time' => now()->timestamp, 'visit' => (string) Str::uuid(),
            'session' => hash('sha256', $request->session()->getId()),
        ]));

        return response()->json(['token' => $token])->header('Cache-Control', 'no-store')
            ->cookie('news_visitor', $anonymous, config('engagement.anonymous_retention_days') * 1440,
                '/', null, $request->isSecure(), true, false, 'lax');
    }

    public function view(Request $request, string $id)
    {
        $data = $request->validate(['token' => 'required|string|max:2000']);
        try {
            $token = json_decode(Crypt::decryptString($data['token']), true);
            $valid = (string) $token['news'] === $id && now()->timestamp - $token['time'] >= 5
                && now()->timestamp - $token['time'] <= 7200
                && hash_equals($token['session'], hash('sha256', $request->session()->getId()));
        } catch (\Throwable $e) {
            $valid = false;
        }
        abort_unless($valid, 422);
        $views = DB::transaction(function () use ($id, $token) {
            $news = News::active()->lockForUpdate()->findOrFail($id);
            $visit = hash('sha256', $token['visit']);
            if (DB::table('news_visits')->where('id', $visit)->exists()) {
                return (int) $news->unique_views;
            }
            DB::table('news_visits')->insert(['id' => $visit, 'expires_at' => now()->addDays(config('engagement.visit_retention_days'))]);
            $unique = ! DB::table('news_viewers')->where('news_id', $id)->where('viewer_key', $token['viewer'])->exists();
            if ($unique) {
                DB::table('news_viewers')->insert([
                    'news_id' => $id, 'viewer_key' => $token['viewer'],
                    'expires_at' => str_starts_with($token['viewer'], 'guest:') ? now()->addDays(config('engagement.anonymous_retention_days')) : null,
                ]);
                $news->increment('unique_views');
            }
            $news->increment('view');

            return (int) $news->unique_views;
        });

        return response()->json(['unique_views' => $views]);
    }

    public function report(Request $request, string $id)
    {
        abort_if($request->user()->isAdmin() || $request->user()->isModerator(), 403);
        $data = $request->validate([
            'category' => ['required_without:reason', 'string', Rule::in(config('engagement.report_categories'))],
            'details' => 'nullable|string|max:450',
            'reason' => 'required_without:category|string|max:500',
        ]);
        $category = $data['category'] ?? 'Lainnya';
        $explanation = trim($data['details'] ?? ($data['reason'] ?? '')) ?: null;
        $comment = Comment::where('status', 'published')->findOrFail($id);
        News::active()->findOrFail($comment->newsID);
        DB::table('comment_reports')->insertOrIgnore([
            'comment_id' => $comment->getKey(), 'user_id' => $request->user()->getKey(),
            'category' => $category, 'explanation' => $explanation, 'created_at' => now(),
        ]);

        return response()->json(['message' => 'Laporan diterima. Terima kasih.']);
    }
}
