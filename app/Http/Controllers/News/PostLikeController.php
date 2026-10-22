<?php

namespace App\Http\Controllers\News;

use App\Http\Controllers\Controller;
use App\Services\News\InteractionService;
use Illuminate\Http\Request;

class PostLikeController extends Controller
{
    public function __construct(protected InteractionService $interactionService) {}

    public function store(Request $request, $id)
    {
        $result = $this->interactionService->likeNews($request->user()->getKey(), $id);

        if ($request->expectsJson()) {
            return response()->json($result);
        }

        return back();
    }
}
