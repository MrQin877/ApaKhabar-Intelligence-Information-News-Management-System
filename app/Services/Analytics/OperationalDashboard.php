<?php

namespace App\Services\Analytics;

use App\Models\Comment;
use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsSession;
use App\Models\News;
use App\Models\SocialConnection;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class OperationalDashboard
{
    public function build(User $actor, string $from, string $to): array
    {
        $zone = config('analytics.timezone');
        $start = CarbonImmutable::parse($from, $zone)->startOfDay()->timezone(config('app.timezone'));
        $end = CarbonImmutable::parse($to, $zone)->endOfDay()->timezone(config('app.timezone'));
        $today = CarbonImmutable::now($zone)->startOfDay()->timezone(config('app.timezone'));
        $pending = Comment::awaitingReview();
        $flagged = (clone $pending)->where(fn ($q) => $q->where('ai_flagged', true)->orWhereIn('commentID', DB::table('comment_reports')->whereNull('resolved_at')->select('comment_id'))->orWhereIn('commentID', DB::table('comment_flags')->whereNull('resolved_at')->select('comment_id')))->count();
        $history = DB::table('comment_moderation_history')->where('moderator_id', $actor->getKey());
        $trend = [];
        $events = (clone $history)->whereBetween('created_at', [CarbonImmutable::now($zone)->subDays(6)->startOfDay()->timezone(config('app.timezone')), $today->endOfDay()])->get();
        for ($i = 6; $i >= 0; $i--) {
            $day = CarbonImmutable::now($zone)->subDays($i)->format('Y-m-d');
            $group = $events->filter(fn ($r) => CarbonImmutable::parse($r->created_at, config('app.timezone'))->timezone($zone)->format('Y-m-d') === $day);
            $trend[] = ['label' => $day, 'approved' => $group->where('to_status', 'published')->count(), 'rejected' => $group->whereIn('to_status', ['hidden', 'removed', 'rejected'])->count()];
        }
        $queue = (clone $pending)->with(['news:postID,title', 'author:userID,name'])
            ->withCount(['reporters as unresolved_reports_count' => fn ($q) => $q->whereNull('comment_reports.resolved_at')])
            ->orderByDesc('ai_flagged')->orderByDesc('unresolved_reports_count')->oldest()->limit(5)->get()
            ->map(fn ($c) => ['id' => $c->getKey(), 'title' => $c->news?->title ?? 'Berita tidak tersedia', 'author' => $c->author?->name ?? $c->guest_name ?? 'Tamu', 'registered' => $c->userID !== null, 'content' => $c->content, 'status' => $c->status, 'revision' => $c->moderation_revision, 'ai_flagged' => (bool) $c->ai_flagged, 'flags' => array_keys(array_filter($c->moderation_categories ?? [], fn ($v) => $v === true)), 'reports' => $c->unresolved_reports_count, 'created_at' => $c->created_at?->toIso8601String()])->all();
        $oldest = (clone $pending)->min('created_at');
        $result = ['moderation' => ['pending' => (clone $pending)->count(), 'flagged' => $flagged, 'oldest_minutes' => $oldest ? max(0, (int) CarbonImmutable::parse($oldest, config('app.timezone'))->diffInMinutes(now())) : null, 'oldest_at' => $oldest ? CarbonImmutable::parse($oldest, config('app.timezone'))->toIso8601String() : null, 'today' => (clone $history)->whereBetween('created_at', [$today, CarbonImmutable::now($zone)->endOfDay()->timezone(config('app.timezone'))])->count(), 'queue' => $queue, 'trend' => $trend], 'broadcast' => app(AnalyticsReport::class)->build(['broadcast'], $from, $to)[0]];
        // No demographic, Meta, draft, or post payload is computed for moderators.
        if (! $actor->isAdmin()) {
            return $result;
        }
        $villagers = fn () => User::whereHas('roleRecord', fn ($q) => $q->where('name', 'villager'));
        $result['admin'] = [
            'drafts' => IntelligentNewsDraft::where('created_by', $actor->getKey())->where('status', 'draft')->whereNull('published_news_id')->count() + IntelligentNewsSession::where('created_by', $actor->getKey())->whereNull('draft_id')->where(fn ($q) => $q->where('current_intent', 'generate_news')->orWhere(fn ($legacy) => $legacy->whereNull('current_intent')->whereHas('messages', fn ($messages) => $messages->where('role', 'user')->whereIn('intent', ['generate_news', 'revise_news']))))->count(),
            'active_readers' => DB::table('villager_activity_hours')->whereBetween('hour', [$start->utc(), $end->utc()])->whereIn('user_id', $villagers()->select('userID'))->distinct()->count('user_id'),
            'published' => News::active()->count(),
            'interactions' => DB::table('likes')->whereBetween('created_at', [$start, $end])->whereIn('userID', $villagers()->select('userID'))->count() + Comment::where('status', 'published')->whereBetween('created_at', [$start, $end])->whereIn('userID', $villagers()->select('userID'))->count(),
            'integrations' => SocialConnection::where('user_id', $actor->getKey())->get()->map(fn ($c) => ['platform' => $c->platform, 'account' => $c->account_name, 'attention' => ! $c->isConnected() || $c->insights_status === 'unavailable' || ($c->expires_at && $c->expires_at->lte(now()->addDays(7)))])->all(),
            'publications' => app(PostPerformance::class)->publicationTrend($from, $to),
            'top_posts' => app(PostPerformance::class)->listing('', '', 'views', 1, 4)['data'],
            'recent' => DB::table('comment_moderation_history')->leftJoin('users', 'users.userID', '=', 'comment_moderation_history.moderator_id')->whereNotNull('moderator_id')->orderByDesc('comment_moderation_history.id')->limit(5)->get(['users.name', 'to_status', 'comment_moderation_history.created_at'])->all(),
        ];

        return $result;
    }
}
