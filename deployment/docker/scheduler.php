<?php

// Container scheduler supervisor. Stop accepting work on TERM, then drain active
// schedule:run processes without interrupting their database writes or queue jobs.
if (! extension_loaded('pcntl')) {
    fwrite(STDERR, "Scheduler requires the pcntl extension.\n");
    exit(1);
}

pcntl_async_signals(true);
$stopping = false;
foreach ([SIGTERM, SIGINT, SIGQUIT] as $signal) {
    pcntl_signal($signal, function () use (&$stopping): void {
        if (! $stopping) {
            fwrite(STDOUT, "Scheduler stopping: draining active schedule:run processes.\n");
        }
        $stopping = true;
    });
}

$root = dirname(__DIR__, 2);
$lastMinute = null;
$executions = [];
fwrite(STDOUT, "Scheduler ready: running Laravel schedules at minute boundaries.\n");

while (! $stopping || $executions !== []) {
    $minute = intdiv(time(), 60);
    // Match schedule:work: no immediate extra run on startup between boundaries.
    if (! $stopping && time() % 60 === 0 && $minute !== $lastMinute) {
        $lastMinute = $minute;
        $process = proc_open(
            [PHP_BINARY, $root.'/artisan', 'schedule:run', '--no-interaction'],
            [0 => ['file', '/dev/null', 'r'], 1 => STDOUT, 2 => STDERR],
            $pipes,
            $root,
        );
        if (is_resource($process)) {
            $executions[] = $process;
        } else {
            fwrite(STDERR, "Unable to start schedule:run; retrying at the next minute.\n");
        }
    }

    foreach ($executions as $index => $process) {
        $status = proc_get_status($process);
        if (! $status['running']) {
            if ($status['exitcode'] !== 0) {
                fwrite(STDERR, 'schedule:run exited with code '.$status['exitcode']."\n");
            }
            proc_close($process);
            unset($executions[$index]);
        }
    }

    if (! $stopping || $executions !== []) {
        usleep(200000);
    }
}

fwrite(STDOUT, "Scheduler drained; exiting cleanly.\n");
