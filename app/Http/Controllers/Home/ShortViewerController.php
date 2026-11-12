<?php

namespace App\Http\Controllers\Home;

use App\Http\Controllers\Controller;
use App\Models\ShortVideo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ShortViewerController extends Controller
{
    private function published(int $id): ShortVideo
    {
        return ShortVideo::where('status', 'published')->whereNotNull('published_at')->withPublicEngagement()->findOrFail($id);
    }

    public function show(Request $request, int $id)
    {
        $video = $this->published($id);
        if ($request->expectsJson()) {
            return response()->json(['data' => $video->only(['id', 'title', 'description', 'video_url', 'thumbnail_url', 'view_count', 'likes_count', 'comments_count', 'published_at'])]);
        }
        $base = ShortVideo::where('status', 'published')->whereNotNull('published_at');
        $next = (clone $base)->where(function ($query) use ($video) {
            $query->where('published_at', '<', $video->published_at)
                ->orWhere(fn ($sameDate) => $sameDate->where('published_at', $video->published_at)->where('id', '<', $video->id));
        })->latest('published_at')->latest('id')->value('id');
        $next ??= (clone $base)->where('id', '<>', $video->id)->latest('published_at')->latest('id')->value('id');
        $previous = (clone $base)->where(function ($query) use ($video) {
            $query->where('published_at', '>', $video->published_at)
                ->orWhere(fn ($sameDate) => $sameDate->where('published_at', $video->published_at)->where('id', '>', $video->id));
        })->orderBy('published_at')->orderBy('id')->value('id');
        $previous ??= (clone $base)->where('id', '<>', $video->id)->orderBy('published_at')->orderBy('id')->value('id');

        return Inertia::render('short-viewer', [
            'short' => $video->only(['id', 'title', 'description', 'video_url', 'thumbnail_url', 'view_count', 'likes_count', 'comments_count', 'published_at']),
            'nextShortId' => $next,
            'nextShortPreview' => $next ? (clone $base)->find($next, ['id', 'title', 'thumbnail_url'])?->only(['id', 'title', 'thumbnail_url']) : null,
            'previousShortId' => $previous,
            'commentCount' => (int) $video->comments_count,
            'likedByUser' => $request->user() ? DB::table('short_video_likes')->where('short_video_id', $id)->where('user_id', $request->user()->getKey())->exists() : false,
            'canFlagComments' => $request->user() && ($request->user()->isAdmin() || $request->user()->isModerator()),
        ]);
    }

    public function token(Request $request, int $id)
    {
        $this->published($id);
        $anonymous = $request->cookie('short_visitor');
        if (! is_string($anonymous) || ! Str::isUuid($anonymous)) {
            $anonymous = (string) Str::uuid();
        }
        $viewer = $request->user()
            ? 'user:'.$request->user()->getKey()
            : 'guest:'.hash_hmac('sha256', $anonymous, config('app.key'));
        $token = Crypt::encryptString(json_encode([
            'short' => $id,
            'viewer' => $viewer,
            'time' => now()->timestamp,
            'session' => hash('sha256', $request->session()->getId()),
        ]));

        return response()->json(['token' => $token])->header('Cache-Control', 'no-store')
            ->cookie('short_visitor', $anonymous, 365 * 1440, '/', null, $request->isSecure(), true, false, 'lax');
    }

    public function view(Request $request, int $id)
    {
        $data = $request->validate(['token' => 'required|string|max:2000']);
        try {
            $claim = json_decode(Crypt::decryptString($data['token']), true, 512, JSON_THROW_ON_ERROR);
            $age = now()->timestamp - $claim['time'];
            $visitor = $request->cookie('short_visitor');
            $viewer = $request->user()
                ? 'user:'.$request->user()->getKey()
                : (is_string($visitor) && Str::isUuid($visitor)
                    ? 'guest:'.hash_hmac('sha256', $visitor, config('app.key')) : '');
            $valid = (int) $claim['short'] === $id
                && $age >= 5 && $age <= 7200
                && hash_equals($claim['viewer'], $viewer)
                && hash_equals($claim['session'], hash('sha256', $request->session()->getId()));
        } catch (\Throwable) {
            $valid = false;
        }
        abort_unless($valid, 422);

        $views = DB::transaction(function () use ($id, $viewer) {
            $video = ShortVideo::where('status', 'published')->whereNotNull('published_at')
                ->lockForUpdate()->findOrFail($id);
            $inserted = DB::table('short_video_viewers')->insertOrIgnore([
                'short_video_id' => $id,
                'viewer_key' => $viewer,
                'viewed_at' => now(),
            ]);
            if ($inserted) {
                $video->increment('view_count');
            }

            return (int) $video->view_count;
        });

        return response()->json(['view_count' => $views]);
    }
}
