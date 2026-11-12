<?php

namespace App\Services\News;

use App\Models\Comment;
use Illuminate\Support\Collection;

class PublicNewsEngagement
{
    public static function visibleComments(Collection $comments): Collection
    {
        $published = $comments->keyBy('commentID');

        return $published->filter(function ($comment) use ($published) {
            $parentId = $comment->parentID;
            $seen = [];
            while ($parentId) {
                if (isset($seen[$parentId]) || ! isset($published[$parentId])) {
                    return false;
                }
                $seen[$parentId] = true;
                $parentId = $published[$parentId]->parentID;
            }

            return true;
        });
    }

    public static function loadCounts(Collection $news): Collection
    {
        if ($news->isEmpty()) {
            return $news;
        }
        $news->loadCount('likes');
        $comments = Comment::whereIn('newsID', $news->modelKeys())->where('status', 'published')
            ->get(['commentID', 'newsID', 'parentID'])->groupBy('newsID');
        foreach ($news as $item) {
            $item->setAttribute('comments_count', self::visibleComments($comments->get($item->getKey(), collect()))->count());
        }

        return $news;
    }
}
