<?php

namespace App\Http\Controllers\News;

use App\Http\Controllers\Controller;
use App\Services\News\InteractionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;

class CommentController extends Controller
{
    public function __construct(protected InteractionService $interactionService) {}

    public function store(Request $request, $id)
    {
        $data = $request->validate([
            'content' => 'required|string|max:1000',
            'website' => 'nullable|string|max:0', 'challenge' => 'nullable|string|max:2000',
        ]);
        if (! $request->user()) {
            try {
                $challenge = json_decode(Crypt::decryptString($data['challenge'] ?? ''), true);
                $valid = (string) $challenge['news'] === (string) $id
                    && hash_equals($challenge['session'], hash('sha256', $request->session()->getId()))
                    && now()->timestamp - $challenge['time'] >= 3 && now()->timestamp - $challenge['time'] <= 7200;
            } catch (\Throwable $e) {
                $valid = false;
            }
            if (! $valid) {
                throw ValidationException::withMessages(['content' => 'Muat ulang artikel dan tunggu beberapa detik sebelum mengirim.']);
            }
        }
        $comment = $this->interactionService->addComment($request->user()?->getKey(), $id, $data['content']);

        return $request->expectsJson()
            ? response()->json(['status' => $comment->status, 'message' => $comment->status === 'published' ? 'Komentar diterbitkan.' : 'Komentar menunggu peninjauan moderator.'], 201)
            : back();
    }

    public function reply(Request $request, $commentId)
    {
        $data = $request->validate(['content' => 'required|string|max:1000']);
        $comment = $this->interactionService->addReply($request->user()->getKey(), $commentId, $data['content']);

        return $request->expectsJson() ? response()->json(['status' => $comment->status], 201) : back();
    }
}
