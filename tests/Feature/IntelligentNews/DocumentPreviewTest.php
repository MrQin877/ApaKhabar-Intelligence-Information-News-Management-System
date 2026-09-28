<?php

use App\Models\IntelligenceDocument;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

function previewFixture($name = 'sheet.xlsx')
{
    Storage::fake('local');
    $user = User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => 'admin'])->getKey()]);
    $doc = IntelligenceDocument::create(['uploaded_by' => $user->getKey(), 'original_name' => $name, 'storage_disk' => 'local', 'storage_path' => 'test/'.$name, 'file_size' => 10, 'sha256' => str_repeat('e', 64), 'status' => 'ready']);
    Storage::disk('local')->put($doc->storage_path, 'test bytes');

    return [$user, $doc];
}

test('spreadsheet preview renders sheets and escapes cell content', function () {
    [$user, $doc] = previewFixture();
    Http::fake(['*/documents/upload' => Http::response(['elements' => [
        ['element_type' => 'table_row', 'content' => 'Name | Value', 'source' => ['sheet' => 'Attendance', 'row' => 1], 'metadata' => ['cells' => ['Name', '<script>alert(1)</script>']]],
        ['element_type' => 'table_row', 'content' => 'Total | 10', 'source' => ['sheet' => 'Totals', 'row' => 1], 'metadata' => ['cells' => ['Total', '10']]],
    ]])]);
    $this->actingAs($user)->get(route('admin.documents.preview', $doc))->assertOk()->assertSee('Attendance')->assertSee('Totals')->assertSee('&lt;script&gt;alert(1)&lt;/script&gt;', false)->assertDontSee('<script>alert(1)</script>', false)->assertSee('<table>', false);
});

test('word preview renders paragraphs and original download skips conversion', function () {
    [$user, $doc] = previewFixture('report.docx');
    Http::fake(['*/documents/upload' => Http::response(['elements' => [['element_type' => 'paragraph', 'content' => 'Village report', 'source' => ['sheet' => null]]]])]);
    $this->actingAs($user)->get(route('admin.documents.preview', $doc))->assertOk()->assertSee('Village report')->assertSee('Isi dokumen');
    $this->get(route('admin.documents.preview', ['document' => $doc->id, 'download' => 1]))->assertDownload('report.docx');
    Http::assertSentCount(1);
});

test('preview enforces document ownership and offers download when conversion fails', function () {
    [$user, $doc] = previewFixture();
    Http::fake(['*/documents/upload' => Http::response([], 503)]);
    $other = User::factory()->create(['roleID' => $user->roleID]);
    $this->actingAs($other)->get(route('admin.documents.preview', $doc))->assertForbidden();
    Http::assertNothingSent();
    $this->actingAs($user)->get(route('admin.documents.preview', $doc))->assertStatus(503)->assertSee('Unduh file asli');
});
