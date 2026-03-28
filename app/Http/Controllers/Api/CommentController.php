<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\News;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function store(Request $request, $id)
    {
        $news = News::find($id);

        if (!$news) {
            return response()->json(['message' => 'News not found'], 404);
        }

        $request->validate(['content' => 'required|string|max:1000']);

        $comment = Comment::create([
            'news_id'   => (string) $news->_id,
            'user_id'   => auth()->id(),
            'content'   => $request->content,
            'parent_id' => null,
        ]);

        return response()->json($comment, 201);
    }

    public function reply(Request $request, $commentId)
    {
        $comment = Comment::find($commentId);

        if (!$comment) {
            return response()->json(['message' => 'Comment not found'], 404);
        }

        $request->validate(['content' => 'required|string|max:1000']);

        $reply = Comment::create([
            'news_id'   => $comment->news_id,
            'user_id'   => auth()->id(),
            'content'   => $request->content,
            'parent_id' => (string) $comment->_id,
        ]);

        return response()->json($reply, 201);
    }
}