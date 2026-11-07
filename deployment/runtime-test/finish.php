<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
if(config('database.connections.mysql.host')!=='db'||config('queue.connections.database.table')!=='phase2b_jobs')throw new RuntimeException('Isolation required');
if(($argv[1]??'')==='verify') {
 $draft=App\Models\IntelligentNewsDraft::findOrFail(21);
 if(!str_starts_with($draft->title,'Phase2C disposable'))throw new RuntimeException('Wrong draft');
 $news=App\Models\News::findOrFail($draft->published_news_id);
 echo json_encode(['website_news_id'=>$news->getKey(),'draft_status'=>$draft->status,'news_status'=>$news->status,'social_ids_empty'=>empty($draft->facebook_post_id)&&empty($draft->instagram_media_id)]).PHP_EOL;
 $schedule=new Illuminate\Console\Scheduling\Schedule();
 $event=$schedule->call(function(){file_put_contents('/tmp/phase2c-schedule-result','ok');})->everyMinute();
 $event->run($app);
 if(file_get_contents('/tmp/phase2c-schedule-result')!=='ok')throw new RuntimeException('Schedule probe failed');
 echo "Isolated scheduler callback passed; production schedule not executed\n";
}elseif(($argv[1]??'')==='cleanup'){
 $draft=App\Models\IntelligentNewsDraft::findOrFail(21);
 if(!str_starts_with($draft->title,'Phase2C disposable'))throw new RuntimeException('Wrong draft');
 $news=App\Models\News::findOrFail($draft->published_news_id);
 if(!str_starts_with($news->title,'Phase2C disposable'))throw new RuntimeException('Wrong news');
 DB::transaction(function()use($draft,$news){$draft->forceDelete();$news->delete();});
 $record=json_decode(file_get_contents('/tmp/phase2c-short.json'),true);
 $v=App\Models\ShortVideo::findOrFail($record['id']);
 if($v->title!=='Phase2C disposable crop test')throw new RuntimeException('Wrong video');
 $local=app(App\Services\Shorts\LocalShortMedia::class);
 foreach(array_unique([$record['original'],$v->metadata['local_path']??null,$local->pathFromUrl($v->thumbnail_url)]) as $path)$local->delete($path);
 $v->forceDelete();
 DB::table('failed_jobs')->where('payload','like','%Phase2CQueueProbe%')->delete();
 foreach(['default','documents','generation','video-publishing'] as $q)unlink(storage_path('app/private/phase2c-queue-'.$q));
 echo "Phase2C disposable records, job failure and video files removed\n";
}else{
 $fks=DB::select('SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL');$errors=0;
 foreach($fks as $fk){foreach((array)$fk as $name)if(!preg_match('/^[a-zA-Z0-9_]+$/',$name))throw new RuntimeException('Invalid identifier');$errors+=DB::selectOne("SELECT COUNT(*) AS n FROM `{$fk->TABLE_NAME}` a LEFT JOIN `{$fk->REFERENCED_TABLE_NAME}` b ON a.`{$fk->COLUMN_NAME}`=b.`{$fk->REFERENCED_COLUMN_NAME}` WHERE a.`{$fk->COLUMN_NAME}` IS NOT NULL AND b.`{$fk->REFERENCED_COLUMN_NAME}` IS NULL")->n;}
 echo json_encode(['foreign_keys'=>count($fks),'orphans'=>$errors,'test_jobs'=>DB::table('phase2b_jobs')->count(),'restored_jobs'=>DB::table('jobs')->count()]).PHP_EOL;
 if($errors)exit(1);
}
