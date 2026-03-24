<?php

namespace App\Http\Controllers;

use App\Models\Like;
use App\Models\News;

class PostLikeController extends Controller
{
    public function store($id)
    {
        $news = News::find($id);

        abort_if(!$news, 404);

        $existing = Like::where('news_id', (string) $news->_id)
                        ->where('user_id', auth()->id())
                        ->first();

        if ($existing) {
            $existing->delete();
            $news->decrement('likes_count');
        } else {
            Like::create([
                'news_id' => (string) $news->_id,
                'user_id' => auth()->id(),
            ]);
            $news->increment('likes_count');
        }

        return back();
    }
}