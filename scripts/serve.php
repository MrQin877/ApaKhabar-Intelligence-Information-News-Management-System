<?php

// Use the same PHP executable as the caller, without requiring Bash or WSL.
$projectRoot = dirname(__DIR__);
chdir($projectRoot);
// Preserve PHP's default additional INI directory when no override is set.
putenv('PHP_INI_SCAN_DIR='.(getenv('PHP_INI_SCAN_DIR') ?: '').PATH_SEPARATOR.$projectRoot.'/config/php');

$process = proc_open(
    [PHP_BINARY, $projectRoot.'/artisan', 'serve', '--no-reload', ...array_slice($argv, 1)],
    [0 => STDIN, 1 => STDOUT, 2 => STDERR],
    $pipes,
    $projectRoot,
);

exit(is_resource($process) ? proc_close($process) : 1);
