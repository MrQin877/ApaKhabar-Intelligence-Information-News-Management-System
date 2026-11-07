<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
class Phase2BJob implements Illuminate\Contracts\Queue\ShouldQueue {
    use Illuminate\Bus\Queueable;
    public int $tries=1;
    public function __construct(public bool $fail=false) {}
    public function handle(): void {
        if($this->fail) { throw new RuntimeException('Intentional disposable queue failure'); }
        $path=storage_path('app/private/phase2b-video.mp4');
        $p=new Symfony\Component\Process\Process(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=blue:s=160x120:d=1','-c:v','libx264','-threads','1',$path]);
        $p->mustRun();
        $probe=new Symfony\Component\Process\Process(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',$path]);
        $probe->mustRun();
        if((float)$probe->getOutput()<0.9) {throw new RuntimeException('Invalid disposable video');}
        file_put_contents(storage_path('app/private/phase2b-job-result.txt'),'FFmpeg and ffprobe passed');
    }
}
if(config('database.connections.mysql.host')!=='db' || config('queue.connections.database.table')!=='phase2b_jobs') {throw new RuntimeException('Isolated queue required');}
if(($argv[1]??'')==='dispatch') {
    Illuminate\Support\Facades\Queue::push(new Phase2BJob(false),'','phase2b-safe');
    Illuminate\Support\Facades\Queue::push(new Phase2BJob(true),'','phase2b-safe');
    echo "Two disposable jobs queued; restored jobs untouched\n";
} else {
    Illuminate\Support\Facades\Artisan::call('queue:work',['--queue'=>'phase2b-safe','--stop-when-empty'=>true,'--tries'=>1,'--timeout'=>30]);
    echo Illuminate\Support\Facades\Artisan::output();
    echo file_get_contents(storage_path('app/private/phase2b-job-result.txt')).PHP_EOL;
    echo 'Remaining test jobs: '.Illuminate\Support\Facades\DB::table('phase2b_jobs')->count().PHP_EOL;
    echo 'Recorded intentional failures: '.Illuminate\Support\Facades\DB::table('failed_jobs')->where('queue','phase2b-safe')->count().PHP_EOL;
}
