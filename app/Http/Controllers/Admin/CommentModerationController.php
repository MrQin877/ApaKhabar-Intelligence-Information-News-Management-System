<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\ShortVideoComment;
use App\Services\News\ModerationDecisionService;
use App\Services\Shorts\ShortCommentDecisionService;
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
            'content_type' => ['sometimes', Rule::in(['news', 'shorts'])],
        ]);
        if (($data['content_type'] ?? 'news') === 'shorts') {
            return $this->shorts($request, $data);
        }
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
                $decisions->where(fn ($q) => $q->where('reason', 'like', 'restore:%')
                    ->orWhere(fn ($q) => $q->where('action', 'allow')->whereIn('from_status', ['hidden', 'removed', 'rejected'])));
            } elseif ($decision === 'rejected') {
                $decisions->whereIn('to_status', ['hidden', 'removed', 'rejected']);
            } elseif ($decision === 'approved') {
                $decisions->where('to_status', 'published')->whereNotIn('from_status', ['hidden', 'removed', 'rejected'])
                    ->where('reason', 'not like', 'restore:%');
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
                $flags = DB::table('comment_flags')->select('comment_id');
                if ($pendingOnly) {
                    $flags->whereNull('resolved_at');
                }
                $query->whereIn('commentID', $flags);
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

        $feedback = DB::table('archived_comment_moderation_feedback')
            ->whereIn('comment_id', $ids)
            ->orderByDesc('id')->get()
            ->map(function ($row) {
                $administrator = json_decode($row->administrator_snapshot ?? 'null', true);
                $row->administrator_name = $administrator['name'] ?? null;

                return $row;
            })->groupBy('comment_id');
        $flags = DB::table('comment_flags')->leftJoin('users', 'comment_flags.moderator_id', '=', 'users.userID')
            ->whereIn('comment_id', $ids)->select('comment_flags.*', 'users.name as moderator_name')
            ->orderByDesc('comment_flags.id')->get()->groupBy('comment_id');

        $comments->through(fn ($comment) => [
            'id' => $comment->getKey(),
            'content_type' => 'news',
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
            'flags' => $flags->get($comment->getKey(), []),
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
                'content_type' => 'news',
            ],
        ]);
    }

    private function shorts(Request $request, array $data)
    {
        $tab = $data['tab'] ?? 'pending';
        $source = $data['source'] ?? 'all';
        $decision = $data['decision'] ?? 'all';
        $search = trim($data['search'] ?? '');
        $pending = ShortVideoComment::awaitingReview();
        $query = ShortVideoComment::query()->with(['video:id,title', 'author:userID,name']);
        if ($tab === 'pending') {
            $query->awaitingReview();
        } else {
            $query->whereNotIn('id', (clone $pending)->select('id'))
                ->whereIn('id', DB::table('short_video_comment_history')->whereNotNull('moderator_id')->select('comment_id'));
            $latest = DB::table('short_video_comment_history')->selectRaw('MAX(id)')->groupBy('comment_id');
            $decisions = DB::table('short_video_comment_history')->whereIn('id', $latest);
            if ($decision === 'restored') {
                $decisions->where(fn ($q) => $q->where('reason', 'like', 'restore:%')
                    ->orWhere(fn ($q) => $q->where('action', 'allow')->whereIn('from_status', ['hidden', 'removed', 'rejected'])));
            } elseif ($decision === 'rejected') {
                $decisions->whereIn('to_status', ['hidden', 'removed', 'rejected']);
            } elseif ($decision === 'approved') {
                $decisions->where('to_status', 'published')->whereNotIn('from_status', ['hidden', 'removed', 'rejected'])
                    ->where('reason', 'not like', 'restore:%');
            }
            if (! empty($data['from'])) {
                $decisions->whereDate('created_at', '>=', $data['from']);
            }
            if (! empty($data['until'])) {
                $decisions->whereDate('created_at', '<=', $data['until']);
            }
            $query->whereIn('id', $decisions->select('comment_id'));
        }
        $applySource = function ($query, string $source, bool $pendingOnly) {
            if ($source === 'ai') {
                $query->where('ai_flagged', true);
            } elseif ($source === 'reported') {
                $reports = DB::table('short_video_comment_reports')->select('comment_id');
                if ($pendingOnly) {
                    $reports->whereNull('resolved_at');
                }
                $query->whereIn('id', $reports);
            } elseif ($source === 'admin') {
                $flags = DB::table('short_video_comment_flags')->select('comment_id');
                if ($pendingOnly) {
                    $flags->whereNull('resolved_at');
                }
                $query->whereIn('id', $flags);
            }
        };
        $applySource($query, $source, $tab === 'pending');
        if ($search !== '') {
            $query->where(function ($match) use ($search) {
                $match->where('content', 'like', "%{$search}%")
                    ->orWhere('guest_name', 'like', "%{$search}%")
                    ->orWhereHas('author', fn ($author) => $author->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('video', fn ($video) => $video->where('title', 'like', "%{$search}%"));
            });
        }
        $comments = $query->orderByDesc($tab === 'history' ? 'moderated_at' : 'created_at')->orderByDesc('id')
            ->paginate(20)->withQueryString();
        $ids = $comments->pluck('id');
        $reports = DB::table('short_video_comment_reports')->leftJoin('users', 'short_video_comment_reports.user_id', '=', 'users.userID')
            ->whereIn('comment_id', $ids)->select('short_video_comment_reports.*', 'users.name as reporter_name')->get()->groupBy('comment_id');
        $history = DB::table('short_video_comment_history')->leftJoin('users', 'short_video_comment_history.moderator_id', '=', 'users.userID')
            ->whereIn('comment_id', $ids)->select('short_video_comment_history.*', 'users.name as moderator_name')
            ->orderByDesc('short_video_comment_history.id')->get()->groupBy('comment_id');
        $flags = DB::table('short_video_comment_flags')->leftJoin('users', 'short_video_comment_flags.moderator_id', '=', 'users.userID')
            ->whereIn('comment_id', $ids)->select('short_video_comment_flags.*', 'users.name as moderator_name')
            ->orderByDesc('short_video_comment_flags.id')->get()->groupBy('comment_id');
        $comments->through(fn ($comment) => [
            'id' => $comment->id,
            'content_type' => 'shorts',
            'news_id' => null,
            'news' => $comment->video ? ['id' => $comment->video->id, 'title' => $comment->video->title] : null,
            'user_id' => $comment->user_id,
            'user' => $comment->author ? ['id' => $comment->author->userID, 'name' => $comment->author->name] : null,
            'guest_name' => $comment->guest_name,
            'content' => $comment->content,
            'status' => $comment->status,
            'revision' => $comment->moderation_revision,
            'ai_flagged' => $comment->ai_flagged,
            'categories' => $comment->moderation_categories,
            'reason' => $comment->moderation_reason,
            'created_at' => $comment->created_at?->toISOString(),
            'reports' => $reports->get($comment->id, []),
            'history' => $history->get($comment->id, []),
            'flags' => $flags->get($comment->id, []),
            'feedback' => [],
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
                'content_type' => 'shorts',
            ],
        ]);
    }

    public function legacyHistory(Request $request)
    {
        $data = $request->validate(['comment_id' => 'nullable|integer|min:1']);
        $query = DB::table('archived_comment_moderation_assessments')->orderByDesc('id');
        if (! empty($data['comment_id'])) {
            $query->where('comment_id', $data['comment_id']);
        }
        $assessments = $query->paginate(20)->withQueryString();
        $feedback = DB::table('archived_comment_moderation_feedback')
            ->whereIn('assessment_id', $assessments->pluck('id'))
            ->orderBy('id')->get()->groupBy('assessment_id');
        $assessments->through(function ($assessment) use ($feedback) {
            $assessment->comment_snapshot = json_decode($assessment->comment_snapshot ?? 'null', true);
            $assessment->categories = json_decode($assessment->categories ?? 'null', true);
            $assessment->category_scores = json_decode($assessment->category_scores ?? 'null', true);
            $assessment->feedback = collect($feedback->get($assessment->id, []))->map(function ($row) {
                $row->comment_snapshot = json_decode($row->comment_snapshot ?? 'null', true);
                $row->history_snapshot = json_decode($row->history_snapshot ?? 'null', true);
                $row->administrator_snapshot = json_decode($row->administrator_snapshot ?? 'null', true);

                return $row;
            })->all();

            return $assessment;
        });

        return Inertia::render('admin/comment-legacy-history', [
            'assessments' => $assessments,
            'filters' => ['comment_id' => $data['comment_id'] ?? ''],
        ]);
    }

    public function decide(Request $request, string $id)
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['allow', 'hide'])],
            'reason' => 'nullable|string|max:500',
            'expected_revision' => 'sometimes|integer|min:0',
            'content_type' => ['sometimes', Rule::in(['news', 'shorts'])],
        ]);
        if (($data['content_type'] ?? 'news') === 'shorts') {
            app(ShortCommentDecisionService::class)->decide(
                $request->user(), (int) $id, $data['action'], trim($data['reason'] ?? '') ?: 'Keputusan moderator.', $data['expected_revision'] ?? null,
            );

            return response()->json(['message' => 'Keputusan disimpan.']);
        }
        app(ModerationDecisionService::class)->decide(
            $request->user(), $id, $data['action'], trim($data['reason'] ?? '') ?: 'Keputusan moderator.', $data['expected_revision'] ?? null,
        );

        return response()->json(['message' => 'Keputusan disimpan.']);
    }
}
