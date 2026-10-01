<?php

namespace App\Services;

use App\Models\IntelligenceInformation;
use App\Models\News;
use Illuminate\Support\Collection;

/** Bounded topical retrieval; never widens access to unapproved/private sources. */
class RelatedEditorialContext
{
    public function find(int $owner, string $prompt, Collection $selected): array
    {
        $query = $this->terms($prompt.' '.$selected->pluck('title')->implode(' '));
        if (count($query) < 2) {
            return [];
        }
        $matches = collect();
        $consider = function (string $id, string $title, string $content, string $date) use ($query, $matches): void {
            $overlap = array_intersect($query, $this->terms($title.' '.$content));
            $titleOverlap = array_intersect($query, $this->terms($title));
            if (count($overlap) < 2 || count($titleOverlap) < 1) {
                return;
            }
            $matches->push(['source_id' => $id, 'title' => $title, 'content' => mb_substr($content, 0, 6000),
                'recorded_at' => $date, 'context_type' => 'historical_background',
                'score' => count($overlap) + 2 * count($titleOverlap)]);
        };
        IntelligenceInformation::with('document')->where('review_status', 'approved')->where('is_active', true)
            ->whereNotIn('id', $selected->pluck('id'))
            ->whereHas('document', fn ($q) => $q->where('uploaded_by', $owner)->whereNull('archived_at'))
            ->latest('id')->limit(200)->get()->each(function ($item) use ($consider) {
                $consider('history:information:'.$item->id, $item->title,
                    $item->summary."\n".json_encode(['fields' => $item->fields, 'evidence' => $item->evidence], JSON_UNESCAPED_UNICODE),
                    (string) $item->created_at);
            });
        News::active()->latest('postID')->limit(200)->get()->each(function ($news) use ($consider) {
            $consider('history:news:'.$news->getKey(), $news->title, html_entity_decode(strip_tags($news->content)), (string) $news->created_at);
        });

        return $matches->sortByDesc('score')->take(3)->map(fn ($item) => collect($item)->except('score')->all())->values()->all();
    }

    private function terms(string $text): array
    {
        $stop = explode(' ', 'yang dan atau dari untuk dengan pada dalam ini itu tahun lalu akan buat buatkan berita pengumuman kegiatan dokumen informasi tentang tolong berdasarkan sebagai sudah belum adalah the and this news document please');

        return array_values(array_unique(array_filter(preg_split('/[^\pL\pN]+/u', mb_strtolower($text)),
            fn ($word) => mb_strlen($word) > 2 && ! is_numeric($word) && ! in_array($word, $stop, true))));
    }
}
