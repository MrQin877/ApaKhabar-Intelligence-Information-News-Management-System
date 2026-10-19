<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\News;
use App\Services\News\ModerationDecisionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class CommentModerationController extends Controller
{
    public function index(Request $request)
    {
        $validStatuses = ['all', 'pending_review', 'published', 'rejected', 'removed', 'reported'];
        $filter = $request->query('status');
        if (!in_array($filter, $validStatuses, true)) {
            $filter = 'all';
        }

        $search = trim((string) $request->query('search', ''));
        $sort = $request->query('sort', 'newest');

        $query = Comment::query()->with(['news:postID,title,image,created_at,created_by', 'author:userID,name']);

        if ($filter === 'reported') {
            $query->whereIn('commentID', DB::table('comment_reports')->whereNull('resolved_at')->select('comment_id'));
        } elseif ($filter !== 'all') {
            $query->where('status', $filter);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('content', 'like', "%{$search}%")
                    ->orWhere('guest_name', 'like', "%{$search}%")
                    ->orWhereHas('author', fn ($uq) => $uq->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('news', fn ($nq) => $nq->where('title', 'like', "%{$search}%"));
            });
        }

        if ($sort === 'oldest') {
            $query->oldest('commentID');
        } else {
            $query->latest('commentID');
        }

        $comments = $query->paginate(30)->withQueryString();
        $ids = $comments->pluck('commentID');

        $reports = DB::table('comment_reports')
            ->leftJoin('users', 'comment_reports.user_id', '=', 'users.userID')
            ->whereIn('comment_id', $ids)
            ->select('comment_reports.*', 'users.name as reporter_name')
            ->get()
            ->groupBy('comment_id');

        $history = DB::table('comment_moderation_history')
            ->leftJoin('users', 'comment_moderation_history.moderator_id', '=', 'users.userID')
            ->whereIn('comment_id', $ids)
            ->select('comment_moderation_history.*', 'users.name as moderator_name')
            ->orderByDesc('comment_moderation_history.id')
            ->get()
            ->groupBy('comment_id');

        $comments->through(fn ($comment) => [
            'id' => $comment->getKey(),
            'news_id' => $comment->newsID,
            'news' => $comment->news ? [
                'id' => $comment->news->postID,
                'title' => $comment->news->title,
                'image' => $comment->news->image,
                'created_at' => $comment->news->created_at?->toISOString() ?? (string) $comment->news->created_at,
                'created_by' => $comment->news->created_by,
            ] : null,
            'user_id' => $comment->userID,
            'user' => $comment->author ? [
                'id' => $comment->author->userID,
                'name' => $comment->author->name,
            ] : null,
            'guest_name' => $comment->guest_name,
            'content' => $comment->content,
            'status' => $comment->status,
            'revision' => $comment->moderation_revision,
            'ai_flagged' => $comment->ai_flagged,
            'categories' => $comment->moderation_categories,
            'reason' => $comment->moderation_reason,
            'created_at' => $comment->created_at?->toISOString() ?? (string) $comment->created_at,
            'reports' => $reports->get($comment->getKey(), []),
            'history' => $history->get($comment->getKey(), []),
        ]);

        $counts = [
            'all' => Comment::count(),
            'pending_review' => Comment::where('status', 'pending_review')->count(),
            'reported' => DB::table('comment_reports')->whereNull('resolved_at')->distinct('comment_id')->count('comment_id'),
            'published' => Comment::where('status', 'published')->count(),
            'rejected' => Comment::where('status', 'rejected')->count(),
            'removed' => Comment::where('status', 'removed')->count(),
        ];

        return Inertia::render('admin/comments', [
            'comments' => $comments,
            'status' => $filter,
            'counts' => $counts,
            'filters' => [
                'status' => $filter,
                'search' => $search,
                'sort' => $sort,
            ],
            'analytics' => [
                'total_views' => (int) News::sum('view'),
                'unique_views' => (int) News::sum('unique_views'),
            ],
        ]);
    }

    public function decide(Request $request, string $id)
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['approve', 'reject', 'remove', 'restore', 'dismiss_reports'])],
            'reason' => 'required|string|max:500',
            'expected_revision' => 'sometimes|integer|min:0',
        ]);
        app(ModerationDecisionService::class)->decide(
            $request->user(), $id, $data['action'], $data['reason'], $data['expected_revision'] ?? null,
        );

        return response()->json(['message' => 'Keputusan disimpan.']);
    }
}
