<?php
// Isolated supervisor test: fake artisan only; never boots Laravel or touches DB.
$source = file_get_contents(dirname(__DIR__).'/docker/scheduler.php');
foreach ([true, false] as $active) {
    $root = sys_get_temp_dir().'/apakhabar-scheduler-'.bin2hex(random_bytes(6));
    mkdir($root.'/deployment/docker', 0700, true);
    // A controlled clock avoids waiting for a wall-clock minute boundary.
    $clock = $active ? 120 : 121;
    $supervisor = str_replace('<?php', "<?php\nnamespace SchedulerTest;\nfunction time(): int { return {$clock}; }", $source);
    file_put_contents($root.'/deployment/docker/scheduler.php', $supervisor);
    file_put_contents($root.'/artisan', '<?php file_put_contents(__DIR__."/started", "yes"); usleep(2000000); file_put_contents(__DIR__."/finished", "yes");');
    $process = proc_open([PHP_BINARY, $root.'/deployment/docker/scheduler.php'], [0 => ['file', '/dev/null', 'r'], 1 => ['file', $root.'/output', 'w'], 2 => ['file', $root.'/error', 'w']], $pipes);
    $deadline = microtime(true) + 10;
    while (! is_file($root.($active ? '/started' : '/output')) && microtime(true) < $deadline) {
        usleep(10000);
    }
    if (! $active) { usleep(200000); }
    $start = microtime(true);
    proc_terminate($process, SIGTERM);
    while (($status = proc_get_status($process))['running'] && microtime(true) < $deadline) { usleep(10000); }
    $elapsed = microtime(true) - $start;
    $output = file_get_contents($root.'/output');
    if ($status['running'] || $status['exitcode'] !== 0 || ! str_contains($output, 'exiting cleanly') || ($active && ! is_file($root.'/finished')) || (! $active && is_file($root.'/started'))) {
        throw new RuntimeException('Scheduler shutdown test failed: '.$output.file_get_contents($root.'/error'));
    }
    proc_close($process);
    printf("PASS %s: %.2fs; clean exit, no task interruption\n", $active ? 'active task drain' : 'idle stop', $elapsed);
}
