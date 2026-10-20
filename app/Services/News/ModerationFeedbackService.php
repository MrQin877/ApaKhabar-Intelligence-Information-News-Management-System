<?php

namespace App\Services\News;

use App\Models\Comment;
use App\Models\CommentModerationAssessment;
use App\Models\CommentModerationFeedback;
use App\Models\News;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ModerationFeedbackService
{
    public const REASONS = [
        'harassment' => 'Pelecehan',
        'indirect_insult' => 'Hinaan tidak langsung',
        'threat_intimidation' => 'Ancaman atau intimidasi',
        'hate_speech' => 'Ujaran kebencian',
        'spam' => 'Spam',
        'other' => 'Lainnya',
        'harmless_criticism' => 'Kritik wajar / salah deteksi AI',
    ];

    public function submit(User $actor, string $newsId, string $commentId, array $input): CommentModerationFeedback
    {
        abort_unless($actor->isAdmin() && $actor->hasVerifiedEmail(), 403);
        $data = Validator::make($input, [
            'classification' => ['required', Rule::in(['appropriate', 'inappropriate'])],
            'category' => ['required', Rule::in(array_keys(self::REASONS))],
            'explanation' => 'nullable|string|max:1000',
            'expected_revision' => 'required|integer|min:0',
            'request_id' => 'required|uuid',
        ])->validate();
        Validator::make($data, ['category' => Rule::in($data['classification'] === 'appropriate'
            ? ['harmless_criticism', 'other'] : array_diff(array_keys(self::REASONS), ['harmless_criticism']))])->validate();
        $data['explanation'] = trim($data['explanation'] ?? '') ?: null;

        return DB::transaction(function () use ($actor, $newsId, $commentId, $data) {
            News::active()->findOrFail($newsId);
            $comment = Comment::where('newsID', $newsId)->lockForUpdate()->findOrFail($commentId);
            // A locking read also sees committed retries under MySQL REPEATABLE READ.
            $existing = CommentModerationFeedback::where('request_id', $data['request_id'])->lockForUpdate()->first();
            if ($existing) {
                abort_unless((string) $existing->comment_id === (string) $comment->getKey()
                    && (string) $existing->administrator_id === (string) $actor->getKey()
                    && $existing->classification === $data['classification']
                    && $existing->category === $data['category']
                    && $existing->explanation === $data['explanation']
                    && $existing->expected_revision === (int) $data['expected_revision'], 409, 'Permintaan sudah digunakan untuk koreksi lain.');

                return $existing;
            }
            abort_if($comment->moderation_revision !== (int) $data['expected_revision'], 409, 'Komentar telah berubah. Tutup dialog dan muat ulang komentar.');
            $action = $data['classification'] === 'inappropriate'
                ? ($comment->status === 'published' ? 'remove' : null)
                : match ($comment->status) {
                    'pending_review' => 'approve', 'removed' => 'restore', default => null,
                };
            abort_if($action === null, 409, 'Koreksi tidak tersedia untuk status komentar ini.');
            $assessment = CommentModerationAssessment::capture($comment);
            $historyId = app(ModerationDecisionService::class)->decide(
                $actor, $commentId, $action, self::REASONS[$data['category']], (int) $data['expected_revision'],
            );

            return CommentModerationFeedback::create([
                'comment_id' => $comment->getKey(), 'assessment_id' => $assessment->getKey(),
                'history_id' => $historyId, 'administrator_id' => $actor->getKey(),
                'classification' => $data['classification'], 'category' => $data['category'],
                'explanation' => $data['explanation'], 'verification_status' => 'unverified',
                'request_id' => $data['request_id'], 'expected_revision' => $data['expected_revision'], 'created_at' => now(),
            ]);
        }, 3);
    }
}
