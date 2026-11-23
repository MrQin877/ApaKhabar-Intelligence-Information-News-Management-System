<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\News;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CommentFlagController extends Controller
{
    private function authorizeReviewer(Request $request): void
    {
        abort_unless($request->user()?->hasVerifiedEmail() && ($request->user()->isAdmin() || $request->user()->isModerator()), 403);
    }

    public function index(Request $request, string $news)
    {
        $this->authorizeReviewer($request);
        News::active()->findOrFail($news);
        $comments = Comment::where('newsID', $news)->whereIn('status', ['published', 'pending_review'])
            ->latest('commentID')->paginate(15);
        $comments->through(fn (Comment $comment) => $this->present($comment));

        return response()->json($comments)->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $news, string $comment)
    {
        $this->authorizeReviewer($request);
        News::active()->findOrFail($news);

        return response()->json($this->present(Comment::where('newsID', $news)->findOrFail($comment)))
            ->header('Cache-Control', 'private, no-store');
    }

    public function flag(Request $request, string $news, string $comment)
    {
        $this->authorizeReviewer($request);
        News::active()->findOrFail($news);
        $data = $request->validate([
            'category' => ['required', Rule::in(config('engagement.admin_flag_categories'))],
            'explanation' => 'nullable|string|max:1000',
        ]);
        DB::transaction(function () use ($request, $news, $comment, $data) {
            $item = Comment::where('newsID', $news)->whereIn('status', ['published', 'pending_review'])
                ->lockForUpdate()->findOrFail($comment);
            $exists = DB::table('comment_flags')->where('comment_id', $item->getKey())
                ->where('moderator_id', $request->user()->getKey())->whereNull('resolved_at')->exists();
            if (! $exists) {
                DB::table('comment_flags')->insert([
                    'comment_id' => $item->getKey(), 'moderator_id' => $request->user()->getKey(),
                    'category' => $data['category'], 'explanation' => trim($data['explanation'] ?? '') ?: null,
                    'created_at' => now(),
                ]);
            }
            $item->update(['status' => 'pending_review']);
        });

        return response()->json([
            'message' => 'Komentar berhasil dikirim untuk ditinjau dan disembunyikan sementara.',
        ])->header('Cache-Control', 'private, no-store');
    }

    private function present(Comment $comment): array
    {
        return [
            'id' => (string) $comment->getKey(), 'content' => $comment->content,
            'status' => $comment->status, 'revision' => $comment->moderation_revision,
        ];
    }
}
