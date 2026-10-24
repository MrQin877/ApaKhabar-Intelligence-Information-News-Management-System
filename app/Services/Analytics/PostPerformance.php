<?php

namespace App\Services\Analytics;

use App\Models\News;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class PostPerformance
{
    private function query(string $search, string $category, string $sort, ?string $from, ?string $to): Builder
    {
        $query = News::with('categoryRecord')->withCount(['likes as recorded_likes_count', 'comments as published_comments_count' => fn ($q) => $q->where('status', 'published')]);
        if ($from && $to) {
            $bounds = $this->bounds($from, $to);
            $query->withCount(['likes as period_likes_count' => fn ($q) => $q->whereBetween('created_at', $bounds), 'comments as period_comments_count' => fn ($q) => $q->where('status', 'published')->whereBetween('created_at', $bounds)]);
        }
        $query->when($search !== '', fn ($q) => $q->where('title', 'like', '%'.$search.'%'))->when($category !== '', fn ($q) => $q->where('category_id', $category));
        match ($sort) {
            'unique' => $query->orderByDesc('unique_views'),
            'likes' => $query->orderByDesc($from ? 'period_likes_count' : 'recorded_likes_count'),
            'comments' => $query->orderByDesc($from ? 'period_comments_count' : 'published_comments_count'),
            'ratio' => $query->orderByRaw('((SELECT COUNT(*) FROM likes WHERE likes.postID = news.postID) + (SELECT COUNT(*) FROM comments WHERE comments.newsID = news.postID AND comments.status = ?)) * 1.0 / NULLIF(unique_views, 0) DESC', ['published']),
            'newest' => $query->orderByDesc('created_at'),
            default => $query->orderByDesc('view'),
        };

        return $query->orderByDesc('postID');
    }

    private function row(News $post, bool $period): array
    {
        return ['id' => $post->getKey(), 'title' => $post->title, 'category' => $post->categoryRecord?->name ?? 'Tanpa kategori', 'created_at' => $post->created_at?->toIso8601String(), 'status' => $post->status,
            'views' => (int) $post->view, 'unique' => (int) $post->unique_views, 'likes' => (int) ($period ? $post->period_likes_count : $post->recorded_likes_count), 'comments' => (int) ($period ? $post->period_comments_count : $post->published_comments_count),
            'ratio' => ! $period && $post->unique_views ? round(($post->recorded_likes_count + $post->published_comments_count) / $post->unique_views * 100, 1) : null];
    }

    public function listing(string $search = '', string $category = '', string $sort = 'views', int $page = 1, int $perPage = 15, ?string $from = null, ?string $to = null): array
    {
        $posts = $this->query($search, $category, $sort, $from, $to)->paginate($perPage, ['*'], 'posts_page', $page);

        return ['data' => $posts->getCollection()->map(fn ($p) => $this->row($p, $from !== null))->all(), 'page' => $posts->currentPage(), 'last_page' => $posts->lastPage(), 'total' => $posts->total(),
            'note' => 'Tayangan dan identitas unik bersifat kumulatif; identitas mencakup akun dan tamu, bukan orang unik lintas berita. Suka aktif dan komentar yang kini diterbitkan mengikuti periode laporan. Tamu dapat terhitung lagi setelah retensi berakhir. Tanggal terbit terpisah dan riwayat tayangan harian belum tersedia.'];
    }

    public function selected(int $id, string $from, string $to): array
    {
        return $this->row($this->query('', '', 'views', $from, $to)->whereKey($id)->firstOrFail(), true);
    }

    public function all(string $search, string $category, string $sort, string $from, string $to, ?int $post = null): iterable
    {
        $query = $this->query($post ? '' : $search, $post ? '' : $category, $sort, $from, $to);
        if ($post) {
            $query->whereKey($post);
        }
        foreach ($query->lazy(250) as $item) {
            yield $this->row($item, true);
        }
    }

    public function bounds(string $from, string $to): array
    {
        $zone = config('analytics.timezone');

        return [CarbonImmutable::parse($from, $zone)->startOfDay()->timezone(config('app.timezone')), CarbonImmutable::parse($to, $zone)->endOfDay()->timezone(config('app.timezone'))];
    }

    public function interactionTrend(string $from, string $to, ?int $id = null, string $search = '', string $category = ''): array
    {
        $bounds = $this->bounds($from, $to);
        $zone = config('analytics.timezone');
        $matching = News::query()->select('postID')->when($search !== '', fn ($q) => $q->where('title', 'like', '%'.$search.'%'))->when($category !== '', fn ($q) => $q->where('category_id', $category));
        $likes = DB::table('likes')->when($search !== '' || $category !== '', fn ($q) => $q->whereIn('postID', clone $matching))->when($id !== null, fn ($q) => $q->where('postID', $id))->whereBetween('created_at', $bounds)->get(['created_at']);
        $comments = DB::table('comments')->where('status', 'published')->when($search !== '' || $category !== '', fn ($q) => $q->whereIn('newsID', clone $matching))->when($id !== null, fn ($q) => $q->where('newsID', $id))->whereBetween('created_at', $bounds)->get(['created_at']);
        $date = fn ($r) => CarbonImmutable::parse($r->created_at, config('app.timezone'))->timezone($zone)->format('Y-m-d');
        $l = $likes->countBy($date);
        $c = $comments->countBy($date);
        $trend = [];
        for ($day = CarbonImmutable::parse($from, $zone); $day->lte(CarbonImmutable::parse($to, $zone)); $day = $day->addDay()) {
            $label = $day->format('Y-m-d');
            $trend[] = ['label' => $label, 'likes' => $l[$label] ?? 0, 'comments' => $c[$label] ?? 0];
        }

        return $trend;
    }

    public function inspection(int $id, string $from, string $to): array
    {
        News::findOrFail($id);

        return ['id' => $id, 'trend' => $this->interactionTrend($from, $to, $id), 'note' => 'Tanggal pembuatan suka yang masih aktif dan komentar yang kini diterbitkan. Suka yang dibatalkan tidak memiliki riwayat. Tren tayangan harian belum tersedia.'];
    }

    public function publicationTrend(string $from, string $to): array
    {
        $zone = config('analytics.timezone');
        $start = CarbonImmutable::parse($from, $zone)->startOfDay();
        $end = CarbonImmutable::parse($to, $zone)->endOfDay();
        $counts = News::active()->whereBetween('created_at', [$start->timezone(config('app.timezone')), $end->timezone(config('app.timezone'))])->get(['created_at'])->countBy(fn ($p) => $p->created_at->timezone($zone)->format('Y-m-d'));
        $trend = [];
        for ($day = $start; $day->lte($end); $day = $day->addDay()) {
            $date = $day->format('Y-m-d');
            $trend[] = ['label' => $date, 'value' => $counts[$date] ?? 0];
        }

        return $trend;
    }
}
