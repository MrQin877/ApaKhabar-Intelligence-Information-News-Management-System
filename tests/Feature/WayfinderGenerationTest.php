<?php

use App\Console\Commands\GenerateWayfinder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

test('Wayfinder serializes concurrent generation without duplicating imports', function () {
    expect(Artisan::all()['wayfinder:generate'])->toBeInstanceOf(GenerateWayfinder::class);

    $output = storage_path('framework/testing/wayfinder-'.bin2hex(random_bytes(8)));
    (new Process([
        PHP_BINARY, 'artisan', 'wayfinder:generate', '--with-form', '--path='.$output,
    ], base_path()))->mustRun();
    $modules = collect(['appearance', 'security', 'admin/broadcasting'])->mapWithKeys(
        fn ($route) => [$output.'/routes/'.$route.'/index.ts' => File::get($output.'/routes/'.$route.'/index.ts')],
    );
    $lock = fopen(storage_path('framework/cache/wayfinder-generation.lock'), 'c');
    flock($lock, LOCK_EX);
    $processes = collect(range(1, 2))->map(fn () => new Process([
        PHP_BINARY, 'artisan', 'wayfinder:generate', '--with-form', '--path='.$output,
    ], base_path()));

    try {
        $processes->each->start();
        // Both CLI invocations must wait while another generator owns the lock.
        usleep(1000000);
        $processes->each(fn (Process $process) => expect($process->isRunning())->toBeTrue());
        $modules->each(fn ($content, $path) => expect(File::get($path))->toBe($content));
        flock($lock, LOCK_UN);

        // Vite readers must keep seeing complete modules throughout regeneration.
        while ($processes->contains(fn (Process $process) => $process->isRunning())) {
            $modules->each(fn ($content, $path) => expect(File::get($path))->toBe($content));
            usleep(20000);
        }

        $processes->each(function (Process $process) {
            $process->wait();
            expect($process->isSuccessful())->toBeTrue($process->getErrorOutput());
        });

        foreach (File::allFiles($output) as $file) {
            $source = $file->getContents();
            expect(substr_count($source, 'import { queryParams,'))->toBeLessThanOrEqual(1);
        }

        $broadcasting = File::get($output.'/routes/admin/broadcasting/index.ts');
        expect(substr_count($broadcasting, 'import { queryParams,'))->toBe(1);
        expect($broadcasting)->toContain("url: '/admin/broadcasting'");
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
        $processes->each(fn (Process $process) => $process->stop());
        File::deleteDirectory($output);
    }
});
