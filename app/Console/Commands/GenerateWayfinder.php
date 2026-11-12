<?php

namespace App\Console\Commands;

use Illuminate\Support\Facades\File;
use Laravel\Wayfinder\GenerateCommand;
use RuntimeException;

class GenerateWayfinder extends GenerateCommand
{
    public function handle()
    {
        // Vite hot updates, builds and manual generation share these output files.
        // Wayfinder writes content and prepends imports separately, so concurrent
        // writers can otherwise prepend the same import more than once.
        $lock = fopen(storage_path('framework/cache/wayfinder-generation.lock'), 'c');

        if ($lock === false) {
            throw new RuntimeException('Unable to open the Wayfinder generation lock.');
        }

        $originalPath = $this->option('path');
        $destination = $originalPath ?? resource_path('js');
        $staging = storage_path('framework/cache/wayfinder-'.bin2hex(random_bytes(8)));

        try {
            if (! flock($lock, LOCK_EX)) {
                throw new RuntimeException('Unable to acquire the Wayfinder generation lock.');
            }

            // The upstream command deletes its output directories first. Never
            // let Vite see that intermediate state or a partially written file.
            $this->input->setOption('path', $staging);
            $result = parent::handle();

            if ($result !== null && $result !== self::SUCCESS) {
                return $result;
            }

            foreach (File::allFiles($staging) as $file) {
                $target = $destination.DIRECTORY_SEPARATOR.$file->getRelativePathname();
                $content = $file->getContents();

                // Unchanged modules should not trigger HMR or Windows file locks.
                if (File::exists($target) && File::get($target) === $content) {
                    continue;
                }

                File::ensureDirectoryExists(dirname($target));
                File::replace($target, $content);
            }

            $this->components->info('Wayfinder modules published to '.$destination);

            return self::SUCCESS;
        } finally {
            $this->input->setOption('path', $originalPath);
            File::deleteDirectory($staging);
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
