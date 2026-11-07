<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

uses(Tests\TestCase::class);

beforeEach(function () {
    config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
    DB::purge('sqlite');
    app()->instance('env', 'local');
    $this->backupPath = getenv('APAKHABAR_MODERATION_BACKUP_PATH');
    $this->backupHash = getenv('APAKHABAR_MODERATION_BACKUP_SHA256');
    putenv('APAKHABAR_MODERATION_BACKUP_PATH');
    putenv('APAKHABAR_MODERATION_BACKUP_SHA256');
});

afterEach(function () {
    foreach (['PATH' => $this->backupPath, 'SHA256' => $this->backupHash] as $key => $value) {
        putenv('APAKHABAR_MODERATION_BACKUP_'.$key.($value === false ? '' : '='.$value));
    }
    DB::purge('sqlite');
});

test('fresh installation completes every migration outside testing without a backup', function () {
    $this->artisan('migrate', ['--force' => true])->assertSuccessful();
    expect(Schema::hasColumn('comments', 'moderator_id'))->toBeFalse()
        ->and(Schema::hasTable('comment_moderation_assessments'))->toBeFalse();
});

test('populated legacy data requires a valid backup outside testing', function ($file, $table, $column) {
    Schema::create($table, function (Blueprint $schema) use ($column) {
        $schema->id();
        $schema->string($column)->nullable();
    });
    DB::table($table)->insert([$column => 'legacy value']);
    $migration = require database_path('migrations/'.$file.'.php');
    $guard = new ReflectionMethod($migration, 'requireVerifiedBackup');

    expect(fn () => $guard->invoke($migration))->toThrow(RuntimeException::class, 'A verified SQL backup');
    $backup = tempnam(sys_get_temp_dir(), 'moderation-test-');
    try {
        file_put_contents($backup, '-- test backup');
        putenv('APAKHABAR_MODERATION_BACKUP_PATH='.$backup);
        putenv('APAKHABAR_MODERATION_BACKUP_SHA256='.str_repeat('0', 64));
        expect(fn () => $guard->invoke($migration))->toThrow(RuntimeException::class, 'A verified SQL backup');
        putenv('APAKHABAR_MODERATION_BACKUP_SHA256='.hash_file('sha256', $backup));
        $guard->invoke($migration);
        expect(DB::table($table)->count())->toBe(1);
    } finally {
        unlink($backup);
    }
})->with([
    ['2026_10_26_000004_remove_redundant_moderation_columns', 'comment_reports', 'reason'],
    ['2026_10_26_000004_remove_redundant_moderation_columns', 'short_video_comment_reports', 'reason'],
    ['2026_10_26_000004_remove_redundant_moderation_columns', 'comments', 'moderator_id'],
    ['2026_10_26_000004_remove_redundant_moderation_columns', 'short_video_comments', 'moderator_id'],
    ['2026_10_26_000004_remove_redundant_moderation_columns', 'short_video_comments', 'moderation_assessment'],
    ['2026_10_26_000005_retire_legacy_comment_moderation_tables', 'comment_moderation_assessments', 'reason'],
    ['2026_10_26_000005_retire_legacy_comment_moderation_tables', 'comment_moderation_feedback', 'explanation'],
]);
