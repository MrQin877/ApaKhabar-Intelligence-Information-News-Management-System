<?php

use App\Models\IntelligentNewsDraft;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

test('draft column migration preserves AI and manual content and historical versions', function () {
    $user = User::factory()->create();
    $migration = require database_path('migrations/2026_09_29_180000_unify_draft_article_columns.php');
    $migration->down();
    foreach (['ai', 'manual'] as $method) {
        DB::table('intelligent_news_drafts')->insert([
            'created_by' => $user->getKey(), 'creation_method' => $method,
            'headline' => 'Judul '.$method, 'subheadline' => 'Konteks lama',
            'lead' => 'Pembukaan.', 'body' => json_encode($method === 'ai' ? ['Hasil kegiatan.'] : ['Pembukaan.', 'Hasil kegiatan.']),
            'summary' => 'Ringkasan.', 'labels' => '[]', 'sources_used' => '[]', 'warnings' => '[]',
            'status' => 'draft', 'version' => 1,
        ]);
    }
    $migration->up();
    expect(Schema::hasColumns('intelligent_news_drafts', ['title', 'content', 'excerpt']))->toBeTrue();
    foreach (['headline', 'subheadline', 'lead', 'body', 'summary'] as $column) {
        expect(Schema::hasColumn('intelligent_news_drafts', $column))->toBeFalse();
    }
    foreach (IntelligentNewsDraft::all() as $draft) {
        expect($draft->content)->toBe("Konteks lama\n\nPembukaan.\n\nHasil kegiatan.");
        expect($draft->excerpt)->toBe('Ringkasan.');
    }
    $migration->down();
    $migration->up();
    expect(IntelligentNewsDraft::first()->content)->toBe("Konteks lama\n\nPembukaan.\n\nHasil kegiatan.");
});
