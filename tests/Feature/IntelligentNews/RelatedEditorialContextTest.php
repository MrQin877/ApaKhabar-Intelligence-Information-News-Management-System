<?php

use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
use App\Models\News;
use App\Models\User;
use App\Services\RelatedEditorialContext;

test('related context includes matching approved history and published news only', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $make = function ($user, $status = 'approved', $archived = false, $title = 'Pelatihan foto produk UMKM') {
        $doc = IntelligenceDocument::create(['uploaded_by' => $user->getKey(), 'original_name' => 'history.txt', 'storage_disk' => 'local', 'storage_path' => 'history.txt', 'file_size' => 10, 'sha256' => str_repeat('b', 64), 'status' => 'ready', 'archived_at' => $archived ? now() : null]);

        return IntelligenceInformation::create(['document_id' => $doc->id, 'item_index' => 0, 'type' => 'Event', 'title' => $title, 'summary' => $title, 'search_text' => $title, 'labels' => [], 'fields' => [], 'evidence' => [], 'review_status' => $status, 'is_active' => true]);
    };
    $current = $make($owner);
    $history = $make($owner);
    $make($other);
    $make($owner, 'pending');
    $make($owner, 'rejected');
    $make($owner, 'approved', true);
    $make($owner, 'approved', false, 'Perbaikan jembatan sungai');
    $published = News::factory()->create(['title' => 'Pelatihan foto produk UMKM 2025', 'content' => 'Pelatihan foto produk diikuti 22 warga pada 2025.', 'status' => 'active']);
    News::factory()->create(['title' => 'Pelatihan foto produk UMKM', 'status' => 'archived']);
    $result = app(RelatedEditorialContext::class)->find($owner->getKey(), 'Buat berita kegiatan ini', collect([$current]));
    expect(array_column($result, 'source_id'))->toEqualCanonicalizing(['history:information:'.$history->id, 'history:news:'.$published->getKey()]);
    expect(app(RelatedEditorialContext::class)->find($owner->getKey(), 'Buat berita', collect()))->toBe([]);
});
