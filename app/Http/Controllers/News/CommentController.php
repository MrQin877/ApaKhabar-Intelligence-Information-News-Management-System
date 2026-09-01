<?php

namespace App\Http\Controllers\News;

use App\Http\Controllers\Controller;
use App\Services\News\InteractionService;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function __construct(protected InteractionService $interactionService)
    {
    }

    public function store(Request $request, $id)
    {
        $request->validate(['content' => 'required|string|max:1000']);

        try {
            $comment = $this->interactionService->addComment(auth()->id(), $id, $request->content);
        } catch (\Throwable $e) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'News not found'], 404);
            }

            abort(404);
        }

        if ($request->expectsJson()) {
            return response()->json($comment, 201);
        }

        return back();
    }

    public function reply(Request $request, $commentId)
    {
        $request->validate(['content' => 'required|string|max:1000']);

        try {
            $reply = $this->interactionService->addReply(auth()->id(), $commentId, $request->content);
        } catch (\Throwable $e) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Comment not found'], 404);
            }

            abort(404);
        }

        if ($request->expectsJson()) {
            return response()->json($reply, 201);
        }

        return back();
    }
}