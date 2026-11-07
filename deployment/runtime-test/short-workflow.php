<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if(config('database.connections.mysql.host')!=='db'||config('queue.connections.database.table')!=='phase2b_jobs'){throw new RuntimeException('Test configuration required');}
if(($argv[1]??'')==='create'){
    if(Illuminate\Support\Facades\DB::table('phase2b_jobs')->count()){throw new RuntimeException('Nonempty test queue');}
    $p=new Symfony\Component\Process\Process(['ffmpeg','-v','error','-y','-f','lavfi','-i','testsrc2=size=640x480:rate=25:duration=4','-c:v','libx264','-threads','1','/tmp/phase2c-source.mp4']);$p->mustRun();
    $local=app(App\Services\Shorts\LocalShortMedia::class);
    $asset=$local->store(new Illuminate\Http\UploadedFile('/tmp/phase2c-source.mp4','source.mp4','video/mp4',null,true));
    $edit=['start'=>0.5,'end'=>2.5,'x'=>0.5,'y'=>0.5,'zoom'=>1,'mode'=>'crop'];
    $v=App\Models\ShortVideo::create(['created_by'=>App\Models\User::firstOrFail()->getKey(),'title'=>'Phase2C disposable crop test','video_url'=>$asset['url'],'video_public_id'=>'','thumbnail_url'=>'','frame_offset'=>0.5,'status'=>'draft','metadata'=>['local_path'=>$asset['path'],'crop_source'=>$asset,'cover_source'=>'frame','processing'=>App\Jobs\ProcessShortVideo::pending($edit)]]);
    file_put_contents('/tmp/phase2c-short.json',json_encode(['id'=>$v->id,'original'=>$asset['path']]));
    App\Jobs\ProcessShortVideo::enqueue($v);
    echo 'Real ProcessShortVideo queued on default; disposable ID '.$v->id.PHP_EOL;
}else{
    $record=json_decode(file_get_contents('/tmp/phase2c-short.json'),true);$v=App\Models\ShortVideo::findOrFail($record['id']);
    echo json_encode(['status'=>$v->metadata['processing']['status'],'width'=>$v->metadata['width']??null,'height'=>$v->metadata['height']??null,'duration'=>$v->metadata['duration']??null,'thumbnail'=>!empty($v->thumbnail_url),'video_url'=>$v->video_url]).PHP_EOL;
    if($v->metadata['processing']['status']!=='ready'){exit(1);}
    file_put_contents('/tmp/phase2c-http-media.json',json_encode(['video'=>$v->video_url,'thumbnail'=>$v->thumbnail_url]));
}
