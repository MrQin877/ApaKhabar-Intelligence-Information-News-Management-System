<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\News;
use App\Services\News\ModerationFeedbackService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;

class ModerationFeedbackController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->isAdmin() && $request->user()->hasVerifiedEmail(), 403);
    }

    public function index(Request $request, string $news)
    {
        $this->authorizeAdmin($request);
        News::active()->findOrFail($news);
        $comments = Comment::where('newsID', $news)->whereIn('status', ['pending_review', 'removed'])
            ->latest('commentID')->paginate(15);
        $comments->through(fn (Comment $comment) => $this->present($comment));

        return response()->json($comments)->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $news, string $comment)
    {
        $this->authorizeAdmin($request);
        News::active()->findOrFail($news);

        return response()->json($this->present(Comment::where('newsID', $news)->findOrFail($comment)))
            ->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request, string $news, string $comment, ModerationFeedbackService $service)
    {
        $this->authorizeAdmin($request);
        try {
            $feedback = $service->submit($request->user(), $news, $comment, $request->all());
        } catch (UniqueConstraintViolationException $e) {
            abort(409, 'Permintaan sudah diproses. Muat ulang komentar.');
        }

        return response()->json([
            'message' => 'Koreksi disimpan. Umpan balik belum diverifikasi dan belum digunakan untuk AI.',
            'feedback_id' => $feedback->getKey(),
        ])->header('Cache-Control', 'private, no-store');
    }

    private function present(Comment $comment): array
    {
        return [
            'id' => (string) $comment->getKey(), 'content' => $comment->content,
            'status' => $comment->status, 'revision' => $comment->moderation_revision,
            'ai_flagged' => $comment->ai_flagged,
        ];
    }
}
