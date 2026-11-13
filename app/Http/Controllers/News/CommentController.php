<?php

namespace App\Http\Controllers\News;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Services\GuestCommentIdentity;
use App\Services\MobileGuestChallenge;
use App\Services\News\InteractionService;
use App\Services\News\PublicNewsEngagement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;

class CommentController extends Controller
{
    public function __construct(protected InteractionService $interactionService) {}

    public function store(Request $request, $id)
    {
        $data = $request->validate([
            'content' => 'required|string|max:1000',
            'website' => 'nullable|string|max:0', 'challenge' => 'nullable|string|max:2000',
        ]);
        $this->checkGuestChallenge($request, (string) $id, $data);
        [$comment, $remaining] = app(GuestCommentIdentity::class)->submit($request,
            fn ($guestName) => $this->interactionService->addComment($request->user()?->getKey(), $id, $data['content'], null, $guestName));

        return $request->expectsJson()
            ? $this->submissionResponse($comment, $remaining)
            : back();
    }

    public function like(Request $request, string $id)
    {
        return response()->json($this->interactionService->likeComment($request->user()->getKey(), $id));
    }

    public function reply(Request $request, $commentId)
    {
        $data = $request->validate(['content' => 'required|string|max:1000', 'website' => 'nullable|string|max:0', 'challenge' => 'nullable|string|max:2000']);
        $parent = Comment::where('status', 'published')->findOrFail($commentId);
        $this->checkGuestChallenge($request, (string) $parent->newsID, $data);
        [$comment, $remaining] = app(GuestCommentIdentity::class)->submit($request,
            fn ($guestName) => $this->interactionService->addReply($request->user()?->getKey(), $commentId, $data['content'], $guestName));

        return $request->expectsJson() ? $this->submissionResponse($comment, $remaining) : back();
    }

    private function submissionResponse(Comment $comment, ?int $remaining)
    {
        $published = Comment::where('newsID', $comment->newsID)->where('status', 'published')->get(['commentID', 'parentID']);

        return response()->json([
            'status' => $comment->status, 'remaining_quota' => $remaining,
            'comments_count' => PublicNewsEngagement::visibleComments($published)->count(),
            'message' => $comment->status === 'published' ? 'Komentar diterbitkan.' : 'Komentar menunggu peninjauan moderator.',
        ], 201);
    }

    private function checkGuestChallenge(Request $request, string $newsId, array $data): void
    {
        if ($request->user()) {
            return;
        }
        if ($request->attributes->has('mobile_guest_identity')) {
            app(MobileGuestChallenge::class)->validate($request, 'news', $newsId, $data);

            return;
        }
        try {
            $claim = json_decode(Crypt::decryptString($data['challenge'] ?? ''), true);
            $age = now()->timestamp - $claim['time'];
            $valid = (string) $claim['news'] === $newsId && $age >= 3 && $age <= 7200
                && hash_equals($claim['session'], hash('sha256', $request->session()->getId()));
        } catch (\Throwable) {
            $valid = false;
        }
        if (! $valid) {
            throw ValidationException::withMessages(['content' => 'Muat ulang artikel dan tunggu beberapa detik sebelum mengirim.']);
        }
    }
}
