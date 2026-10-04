<?php

namespace App\Services;

use App\Models\AiQualityEvaluation;
use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsDraftVersion;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Throwable;

class DraftQualityReviewService
{
    public function pending(IntelligentNewsDraft $draft, IntelligentNewsDraftVersion $version): AiQualityEvaluation
    {
        return $draft->qualityEvaluations()->create([
            'draft_version_id' => $version->id, 'evaluation_version' => 'saved-draft-review-v1',
            'overall_score' => 0, 'quality_label' => 'evaluation_pending', 'publish_blocked' => true,
            'dimensions' => [], 'claim_checks' => [], 'warnings' => ['Perubahan tersimpan. Pemeriksaan versi terbaru sedang berlangsung.'],
        ]);
    }

    public function evaluate(IntelligentNewsDraft $draft, AiQualityEvaluation $evaluation): bool
    {
        $version = $draft->version;
        if (IntelligentNewsDraftVersion::find($evaluation->draft_version_id)?->version !== $version) {
            return false;
        }
        $sources = $draft->informationSources()->where('review_status', 'approved')->where('is_active', true)
            ->get()->mapWithKeys(fn ($item) => ['information:'.$item->id => $item->only(['title', 'summary', 'fields', 'evidence'])])->all();
        try {
            $timeout = max(1, (int) config('services.apakhabar_ai.timeout', 180));
            if (function_exists('set_time_limit')) {
                @set_time_limit($timeout + 10);
            }
            $quality = Http::acceptJson()->withHeaders(['X-ApaKhabar-Service-Token' => config('services.apakhabar_ai.token', '')])
                ->connectTimeout(5)->timeout($timeout)
                ->post(rtrim(config('services.apakhabar_ai.url'), '/').'/news/review-draft', [
                    'title' => $draft->title, 'content' => $draft->content, 'sources' => (object) $sources,
                ])->throw()->json('quality');
            Validator::make(is_array($quality) ? $quality : [], [
                'quality_score' => 'required|numeric|min:0|max:100', 'quality_label' => 'required|string',
                'publish_blocked' => 'required|boolean', 'dimensions' => 'required|array',
                'claim_checks' => 'present|array', 'warnings' => 'present|array',
            ])->validate();
            if (! $sources || empty($quality['claim_checks']) || collect($quality['claim_checks'])->contains(
                fn ($claim) => ! ($claim['supported'] ?? false) || empty($claim['source_ids'])
                    || array_diff($claim['source_ids'], array_keys($sources))
            )) {
                $quality['publish_blocked'] = true;
            }
            $attributes = [
                'overall_score' => $quality['quality_score'], 'quality_label' => $quality['quality_label'],
                'publish_blocked' => $quality['publish_blocked'], 'dimensions' => $quality['dimensions'],
                'claim_checks' => $quality['claim_checks'], 'warnings' => $quality['warnings'],
                'evaluator_model' => $quality['evaluator_model'] ?? null,
            ];
        } catch (Throwable $exception) {
            $attributes = ['quality_label' => 'evaluation_unavailable', 'publish_blocked' => true,
                'warnings' => ['Perubahan tersimpan, tetapi pemeriksaan AI gagal. Simpan kembali untuk mencoba pemeriksaan ulang.']];
        }

        return DB::transaction(function () use ($draft, $version, $evaluation, $attributes) {
            $current = IntelligentNewsDraft::lockForUpdate()->findOrFail($draft->id);
            if ($current->version !== $version || $current->status !== 'draft') {
                return false; // An older review must never overwrite a newer edit.
            }
            $evaluation->update($attributes);
            $current->update(['warnings' => $attributes['warnings']]);

            return ! $attributes['publish_blocked'];
        });
    }
}
