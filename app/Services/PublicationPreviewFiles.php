<?php

namespace App\Services;

use App\Models\IntelligentNewsDraft;
use App\Models\News;
use Illuminate\Support\Facades\Storage;

class PublicationPreviewFiles
{
    public function cleanup(): int
    {
        // Published and saved snapshots keep their exact reviewed image URLs.
        $retained = [];
        $remember = function (?string $url) use (&$retained): void {
            if (preg_match('~(?:^|/)(news-images/previews/[a-f0-9-]+)(?:/|$)~', parse_url($url ?? '', PHP_URL_PATH) ?: '', $match)) {
                $retained[$match[1]] = true;
            }
        };
        IntelligentNewsDraft::query()->select(['id', 'image', 'image_variants'])->chunkById(200, function ($drafts) use ($remember): void {
            foreach ($drafts as $draft) {
                $remember($draft->image);
                foreach ($draft->image_variants ?? [] as $image) {
                    $remember($image);
                }
            }
        });
        foreach (News::query()->pluck('image') as $image) {
            $remember($image);
        }
        $disk = Storage::disk(config('filesystems.news_media_disk', 'public'));
        $removed = 0;
        foreach ($disk->directories('news-images/previews') as $directory) {
            if (isset($retained[$directory])) {
                continue;
            }
            $marker = $directory.'/created-at';
            // One-hour cache lifetime plus a one-hour grace period for in-flight publishing.
            if ($disk->exists($marker) && (int) $disk->get($marker) < now()->subHours(2)->timestamp) {
                if ($disk->deleteDirectory($directory)) {
                    $removed++;
                }
            }
        }

        return $removed;
    }
}
