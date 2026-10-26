<?php

namespace App\Http\Controllers\Home;

use App\Http\Controllers\Controller;
use App\Models\ShortVideo;
use App\Models\ShortVideoComment;
use App\Services\GuestCommentIdentity;
use App\Services\Shorts\ShortCommentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ShortEngagementController extends Controller
{
    private function video(int $id): ShortVideo
    {
        return ShortVideo::where('status', 'published')->whereNotNull('published_at')->findOrFail($id);
    }

    private function comment(ShortVideo $video, int $comment): ShortVideoComment
    {
        return ShortVideoComment::where('short_video_id', $video->id)->where('status', 'published')->findOrFail($comment);
    }

    private function present(ShortVideoComment $comment, ?int $viewer): array
    {
        return [
            'id' => (string) $comment->id,
            'parent_id' => $comment->parent_id ? (string) $comment->parent_id : null,
            'recipient' => $comment->parent_id ? ($comment->parent?->author?->name ?? $comment->parent?->guest_name ?? 'Tamu') : null,
            'author' => $comment->author?->name ?? $comment->guest_name ?? 'Tamu',
            'avatar' => $comment->author?->avatar,
            'content' => $comment->content,
            'date' => $comment->created_at?->locale('id')->diffForHumans(),
            'likes_count' => (int) $comment->likes_count,
            'liked_by_user' => $viewer ? DB::table('short_video_comment_likes')->where('comment_id', $comment->id)->where('user_id', $viewer)->exists() : false,
            'reported_by_user' => $viewer ? DB::table('short_video_comment_reports')->where('comment_id', $comment->id)->where('user_id', $viewer)->exists() : false,
            'replies_count' => (int) ($comment->replies_count ?? 0),
        ];
    }

    public function context(Request $request, int $id)
    {
        $this->video($id);
        $token = Crypt::encryptString(json_encode([
            'short' => $id,
            'time' => now()->timestamp,
            'session' => hash('sha256', $request->session()->getId()),
        ]));

        return response()->json(['challenge' => $token])->header('Cache-Control', 'no-store');
    }

    public function index(Request $request, int $id)
    {
        $this->video($id);
        $comments = ShortVideoComment::where('short_video_id', $id)->where('status', 'published')
            ->whereNull('root_id')->with('author')->withCount(['replies' => fn ($query) => $query->where('status', 'published')])
            ->withCount('likes')->latest()->paginate(10);
        $comments->through(fn ($comment) => $this->present($comment, $request->user()?->getKey()));

        return response()->json([
            'comments' => $comments,
            'count' => ShortVideoComment::where('short_video_id', $id)->where('status', 'published')->count(),
        ])->header('Cache-Control', 'no-store');
    }

    public function replies(Request $request, int $id, int $comment)
    {
        $video = $this->video($id);
        $root = $this->comment($video, $comment);
        abort_unless($root->root_id === null, 404);
        $replies = ShortVideoComment::where('root_id', $root->id)->where('status', 'published')
            ->with(['author', 'parent.author'])->withCount('likes')->oldest()->paginate(3);
        $replies->through(fn ($reply) => $this->present($reply, $request->user()?->getKey()));

        return response()->json($replies)->header('Cache-Control', 'no-store');
    }

    public function store(Request $request, int $id, ShortCommentService $service)
    {
        $video = $this->video($id);
        $data = $request->validate([
            'content' => 'required|string|max:1000',
            'website' => 'nullable|string|max:0',
            'challenge' => 'nullable|string|max:2000',
        ]);
        $this->checkGuestChallenge($request, $id, $data);
        [$comment, $remaining] = app(GuestCommentIdentity::class)->submit($request,
            fn ($guestName) => $service->add($video, $request->user()?->getKey(), $data['content'], null, $guestName));

        return response()->json([
            'status' => $comment->status,
            'remaining_quota' => $remaining,
            'message' => $comment->status === 'published' ? 'Komentar diterbitkan.' : 'Komentar menunggu peninjauan moderator.',
            'comment' => $comment->status === 'published' ? $this->present($comment->load('author'), $request->user()?->getKey()) : null,
        ], 201);
    }

    public function reply(Request $request, int $id, int $comment, ShortCommentService $service)
    {
        $video = $this->video($id);
        $parent = $this->comment($video, $comment);
        $data = $request->validate(['content' => 'required|string|max:1000', 'challenge' => 'nullable|string|max:2000']);
        $this->checkGuestChallenge($request, $id, $data);
        [$reply, $remaining] = app(GuestCommentIdentity::class)->submit($request,
            fn ($guestName) => $service->add($video, $request->user()?->getKey(), $data['content'], $parent, $guestName));

        return response()->json([
            'status' => $reply->status,
            'remaining_quota' => $remaining,
            'message' => $reply->status === 'published' ? 'Balasan diterbitkan.' : 'Balasan menunggu peninjauan moderator.',
            'comment' => $reply->status === 'published' ? $this->present($reply->load(['author', 'parent.author']), $request->user()?->getKey()) : null,
        ], 201);
    }

    private function checkGuestChallenge(Request $request, int $id, array $data): void
    {
        if ($request->user()) {
            return;
        }
        try {
            $claim = json_decode(Crypt::decryptString($data['challenge'] ?? ''), true);
            $age = now()->timestamp - $claim['time'];
            $valid = (int) $claim['short'] === $id && $age >= 3 && $age <= 7200
                && hash_equals($claim['session'], hash('sha256', $request->session()->getId()));
        } catch (\Throwable) {
            $valid = false;
        }
        if (! $valid) {
            throw ValidationException::withMessages(['content' => 'Muat ulang video dan tunggu beberapa detik sebelum mengirim.']);
        }
    }

    public function likeVideo(Request $request, int $id)
    {
        $result = DB::transaction(function () use ($request, $id) {
            $video = ShortVideo::where('status', 'published')->whereNotNull('published_at')->lockForUpdate()->findOrFail($id);
            $query = DB::table('short_video_likes')->where('short_video_id', $id)->where('user_id', $request->user()->getKey());
            $liked = ! $query->exists();
            if ($liked) {
                DB::table('short_video_likes')->insert(['short_video_id' => $id, 'user_id' => $request->user()->getKey()]);
            } else {
                $query->delete();
            }
            $count = DB::table('short_video_likes')->where('short_video_id', $id)->count();
            $video->update(['likes_count' => $count]);

            return ['liked' => $liked, 'likes_count' => $count];
        });

        return response()->json($result);
    }

    public function likeComment(Request $request, int $id, int $comment)
    {
        $video = $this->video($id);
        $result = DB::transaction(function () use ($request, $video, $comment) {
            $item = $this->comment($video, $comment);
            ShortVideoComment::whereKey($item->id)->lockForUpdate()->firstOrFail();
            $query = DB::table('short_video_comment_likes')->where('comment_id', $comment)->where('user_id', $request->user()->getKey());
            $liked = ! $query->exists();
            if ($liked) {
                DB::table('short_video_comment_likes')->insert(['comment_id' => $comment, 'user_id' => $request->user()->getKey()]);
            } else {
                $query->delete();
            }

            return ['liked' => $liked, 'likes_count' => DB::table('short_video_comment_likes')->where('comment_id', $comment)->count()];
        });

        return response()->json($result);
    }

    public function report(Request $request, int $id, int $comment)
    {
        abort_if($request->user()->isAdmin() || $request->user()->isModerator(), 403);
        $video = $this->video($id);
        $item = $this->comment($video, $comment);
        $data = $request->validate([
            'category' => ['required', Rule::in(config('engagement.report_categories'))],
            'details' => 'nullable|string|max:450',
        ]);
        DB::table('short_video_comment_reports')->insertOrIgnore([
            'comment_id' => $item->id,
            'user_id' => $request->user()->getKey(),
            'category' => $data['category'],
            'explanation' => trim($data['details'] ?? '') ?: null,
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Laporan diterima. Terima kasih.']);
    }

    public function flag(Request $request, int $id, int $comment)
    {
        abort_unless($request->user()->hasVerifiedEmail() && ($request->user()->isAdmin() || $request->user()->isModerator()), 403);
        $video = $this->video($id);
        $item = ShortVideoComment::where('short_video_id', $video->id)
            ->whereIn('status', ['published', 'pending_review'])->findOrFail($comment);
        $data = $request->validate([
            'category' => ['required', Rule::in(config('engagement.admin_flag_categories'))],
            'explanation' => 'nullable|string|max:1000',
        ]);
        DB::transaction(function () use ($item, $request, $data) {
            ShortVideoComment::whereKey($item->id)->lockForUpdate()->firstOrFail();
            $exists = DB::table('short_video_comment_flags')->where('comment_id', $item->id)
                ->where('moderator_id', $request->user()->getKey())->whereNull('resolved_at')->exists();
            if (! $exists) {
                DB::table('short_video_comment_flags')->insert([
                    'comment_id' => $item->id,
                    'moderator_id' => $request->user()->getKey(),
                    'category' => $data['category'],
                    'explanation' => trim($data['explanation'] ?? '') ?: null,
                    'created_at' => now(),
                ]);
            }
        });

        return response()->json(['message' => 'Komentar ditandai untuk ditinjau.']);
    }
}
