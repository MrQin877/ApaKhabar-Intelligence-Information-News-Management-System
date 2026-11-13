<?php

namespace App\Http\Controllers\News;

use App\Http\Controllers\Controller;
use App\Models\News;
use App\Models\ShortVideo;
use App\Services\GuestCommentIdentity;
use App\Services\MobileGuestChallenge;
use Illuminate\Http\Request;

class MobileGuestCommentController extends Controller
{
    public function identity(GuestCommentIdentity $identities)
    {
        return response()->json(['token' => $identities->issueToken()], 201)->header('Cache-Control', 'no-store');
    }

    public function news(Request $request, string $id)
    {
        News::active()->findOrFail($id);

        return $this->context($request, 'news', $id);
    }

    public function short(Request $request, string $id)
    {
        ShortVideo::where('status', 'published')->whereNotNull('published_at')->findOrFail($id);

        return $this->context($request, 'short', $id);
    }

    private function context(Request $request, string $kind, string $id)
    {
        return response()->json([
            'challenge' => $request->user() ? null : app(MobileGuestChallenge::class)->issue($request, $kind, $id),
            'ready_in_seconds' => 3, 'expires_in_seconds' => 7200,
        ])->header('Cache-Control', 'no-store');
    }
}
