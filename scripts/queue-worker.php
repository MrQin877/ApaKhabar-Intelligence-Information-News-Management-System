<?php

// concurrently only restarts non-zero exits. Laravel also exits successfully
// when queue:restart is requested, so make that exit restartable as well.
$projectRoot = dirname(__DIR__);
$process = proc_open(
    [PHP_BINARY, $projectRoot.'/artisan', 'queue:work', ...array_slice($argv, 1)],
    [0 => STDIN, 1 => STDOUT, 2 => STDERR],
    $pipes,
    $projectRoot,
);

$status = is_resource($process) ? proc_close($process) : 1;

if ($status === 0) {
    fwrite(STDERR, "Queue worker stopped cleanly; requesting restart from concurrently.\n");
}

exit($status === 0 ? 1 : $status);
