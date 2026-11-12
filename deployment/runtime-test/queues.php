<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Artisan;
if(config('database.connections.mysql.host')!=='db'||config('queue.connections.database.table')!=='phase2b_jobs')throw new RuntimeException('Isolation required');
class Phase2CQueueProbe implements Illuminate\Contracts\Queue\ShouldQueue {
 use Illuminate\Bus\Queueable;
 public $tries=1;
 public $timeout=1;
 public $failOnTimeout=true;
 public function __construct(public string $target, public bool $slow=false){}
 public function handle():void { if($this->slow)sleep(5); file_put_contents(storage_path('app/private/phase2c-queue-'.$this->target), 'completed'); }
}
$mode=$argv[1]??'';
if($mode==='dispatch') {
 if(DB::table('phase2b_jobs')->count())throw new RuntimeException('Queue must be empty');
 foreach(['default','documents','generation','video-publishing'] as $q)Queue::push(new Phase2CQueueProbe($q),'',$q);
 echo "Four isolated queue probes dispatched\n";
}elseif($mode==='timeout'){
 Queue::push(new Phase2CQueueProbe('timeout',true),'','generation');
}elseif($mode==='worker'){
 Artisan::call('queue:work',['--queue'=>$argv[2],'--stop-when-empty'=>true,'--tries'=>1,'--timeout'=>10]);echo Artisan::output();
}elseif($mode==='verify'){
 foreach(['default','documents','generation','video-publishing'] as $q){if(!is_file(storage_path('app/private/phase2c-queue-'.$q)))throw new RuntimeException('Missing completion');}
 $n=DB::table('failed_jobs')->where('payload','like','%Phase2CQueueProbe%')->count();
 echo json_encode(['four_queues_completed'=>true,'timeout_failures'=>$n,'remaining_test_jobs'=>DB::table('phase2b_jobs')->count(),'retry_after'=>config('queue.connections.database.retry_after')]).PHP_EOL;
 if($n!==1||DB::table('phase2b_jobs')->count())exit(1);
}
