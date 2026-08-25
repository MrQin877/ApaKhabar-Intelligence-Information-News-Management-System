<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\News;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function store(Request $request, $id)
    {
        $news = News::find($id);

        abort_if(!$news, 404);

        $request->validate(['content' => 'required|string|max:1000']);

        Comment::create([
            'newsID'    => $news->getKey(),
            'userID'    => auth()->id(),
            'content'   => $request->content,
            'parentID'  => null,
        ]);

        return back();
    }

    public function reply(Request $request, $commentId)
    {
        $comment = Comment::find($commentId);

        abort_if(!$comment, 404);

        $request->validate(['content' => 'required|string|max:1000']);

        Comment::create([
            'newsID'    => $comment->newsID,
            'userID'    => auth()->id(),
            'content'   => $request->content,
            'parentID'  => $comment->getKey(),
        ]);

        return back();
    }
}