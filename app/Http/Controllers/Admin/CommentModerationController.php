<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Services\News\ModerationDecisionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class CommentModerationController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'tab' => ['sometimes', Rule::in(['pending', 'history'])],
            'source' => ['sometimes', Rule::in(['all', 'ai', 'reported', 'admin'])],
            'decision' => ['sometimes', Rule::in(['all', 'approved', 'rejected', 'restored'])],
            'search' => 'nullable|string|max:200',
            'from' => 'nullable|date_format:Y-m-d',
            'until' => ['nullable', 'date_format:Y-m-d', ...($request->filled('from') ? ['after_or_equal:from'] : [])],
        ]);
        $tab = $data['tab'] ?? 'pending';
        $source = $data['source'] ?? ($request->query('status') === 'reported' ? 'reported' : 'all');
        $decision = $data['decision'] ?? 'all';
        $search = trim($data['search'] ?? '');
        $latestHistory = DB::table('comment_moderation_history')->selectRaw('MAX(id)')->groupBy('comment_id');
        $pending = Comment::awaitingReview();
        $query = Comment::query()->with(['news:postID,title', 'author:userID,name']);
        if ($tab === 'pending') {
            $query->awaitingReview();
        } else {
            $query->whereNotIn('commentID', (clone $pending)->select('commentID'))
                ->whereIn('commentID', DB::table('comment_moderation_history')->whereNotNull('moderator_id')->select('comment_id'));
            $decisions = DB::table('comment_moderation_history')->whereIn('id', $latestHistory);
            if ($decision === 'restored') {
                $decisions->where('reason', 'like', 'restore:%');
            } elseif ($decision === 'rejected') {
                $decisions->whereIn('to_status', ['removed', 'rejected']);
            } elseif ($decision === 'approved') {
                $decisions->where('to_status', 'published')->where('reason', 'not like', 'restore:%');
            }
            if (! empty($data['from'])) {
                $decisions->whereDate('created_at', '>=', $data['from']);
            }
            if (! empty($data['until'])) {
                $decisions->whereDate('created_at', '<=', $data['until']);
            }
            $query->whereIn('commentID', $decisions->select('comment_id'));
        }
        $applySource = function ($query, string $source, bool $pendingOnly) {
            if ($source === 'ai') {
                $query->where('ai_flagged', true);
            } elseif ($source === 'reported') {
                $reports = DB::table('comment_reports')->select('comment_id');
                if ($pendingOnly) {
                    $reports->whereNull('resolved_at');
                }
                $query->whereIn('commentID', $reports);
            } elseif ($source === 'admin') {
                $query->whereIn('commentID', DB::table('comment_moderation_feedback')
                    ->where('classification', 'inappropriate')->select('comment_id'));
            }
        };
        $applySource($query, $source, $tab === 'pending');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('content', 'like', "%{$search}%")
                    ->orWhere('guest_name', 'like', "%{$search}%")
                    ->orWhereHas('author', fn ($uq) => $uq->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('news', fn ($nq) => $nq->where('title', 'like', "%{$search}%"));
            });
        }

        $query->orderByDesc($tab === 'history' ? 'moderated_at' : 'created_at')->orderByDesc('commentID');
        $comments = $query->paginate(20)->withQueryString();
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

        $feedback = DB::table('comment_moderation_feedback')
            ->leftJoin('users', 'comment_moderation_feedback.administrator_id', '=', 'users.userID')
            ->whereIn('comment_id', $ids)
            ->select('comment_moderation_feedback.*', 'users.name as administrator_name')
            ->orderByDesc('comment_moderation_feedback.id')->get()->groupBy('comment_id');

        $comments->through(fn ($comment) => [
            'id' => $comment->getKey(),
            'news_id' => $comment->newsID,
            'news' => $comment->news ? [
                'id' => $comment->news->postID,
                'title' => $comment->news->title,
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
            'feedback' => $feedback->get($comment->getKey(), []),
        ]);

        $counts = ['pending' => (clone $pending)->count()];
        foreach (['all', 'ai', 'reported', 'admin'] as $key) {
            $countQuery = clone $pending;
            $applySource($countQuery, $key, true);
            $counts[$key] = $countQuery->count();
        }

        return Inertia::render('admin/comments', [
            'comments' => $comments,
            'counts' => $counts,
            'filters' => [
                'tab' => $tab, 'source' => $source, 'decision' => $decision,
                'search' => $search, 'from' => $data['from'] ?? '', 'until' => $data['until'] ?? '',
            ],
        ]);
    }

    public function decide(Request $request, string $id)
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['approve', 'reject', 'remove', 'restore', 'dismiss_reports'])],
            'reason' => 'nullable|string|max:500',
            'expected_revision' => 'sometimes|integer|min:0',
        ]);
        app(ModerationDecisionService::class)->decide(
            $request->user(), $id, $data['action'], trim($data['reason'] ?? '') ?: 'Keputusan moderator.', $data['expected_revision'] ?? null,
        );

        return response()->json(['message' => 'Keputusan disimpan.']);
    }
}
