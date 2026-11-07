<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if(config('database.connections.mysql.host')!=='db') {exit(1);}
$c=json_decode(file_get_contents('/tmp/phase2b-credentials.json'),true);
$db=Illuminate\Support\Facades\DB::connection();
$db->table('users')->where('userID',$c['userID'])->where('name','Docker disposable runtime test')->delete();
$db->table('failed_jobs')->where('queue','phase2b-safe')->delete();
foreach(['public','local'] as $disk){Illuminate\Support\Facades\Storage::disk($disk)->delete('phase2b-check.txt');}
Illuminate\Support\Facades\Storage::disk('local')->delete(['phase2b-video.mp4','phase2b-job-result.txt']);
unlink('/tmp/phase2b-credentials.json');
echo "Disposable account, failure record and test media removed from Docker only\n";
