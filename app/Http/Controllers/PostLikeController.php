<?php

namespace App\Http\Controllers;

use App\Models\Like;
use App\Models\News;
use Illuminate\Http\Request;

class PostLikeController extends Controller
{
    public function store(Request $request, $id)
    {
        $news = News::find($id);

        abort_if(!$news, 404);

        $existing = Like::where('postID', $news->getKey())
                ->where('userID', auth()->id())
                        ->first();

        if ($existing) {
            $existing->delete();
            $news->decrement('likes_count');
            $liked = false;
        } else {
            Like::create([
                'postID' => $news->getKey(),
                'userID' => auth()->id(),
            ]);
            $news->increment('likes_count');
            $liked = true;
        }

        // Mobile → return JSON
        if ($request->expectsJson()) {
            return response()->json([
                'liked'       => $liked,
                'likes_count' => $news->fresh()->likes_count,
            ]);
        }

        // Web → redirect back as before
        return back();
    }
}