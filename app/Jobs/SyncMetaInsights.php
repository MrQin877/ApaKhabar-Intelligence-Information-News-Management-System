<?php

namespace App\Jobs;

use App\Services\Analytics\MetaInsights;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SyncMetaInsights implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = 300;

    public int $timeout = 90;

    public int $tries = 2;

    public function handle(MetaInsights $insights): void
    {
        $insights->sync();
    }
}
