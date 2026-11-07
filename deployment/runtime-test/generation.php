<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$http=Illuminate\Support\Facades\Http::withHeaders(['X-ApaKhabar-Service-Token'=>config('services.apakhabar_ai.token')])->connectTimeout(5)->timeout(90);
$base=rtrim(config('services.apakhabar_ai.url'),'/');
$start=microtime(true);
try {
 $r=$http->post($base.'/news/generate',['information'=>'The village community library opens at the village hall on 1 November 2026 at 10 AM. Admission is free. The village council organized the opening to improve access to books.','language'=>'en','instructions'=>'Write a short factual announcement using only the supplied facts.','content_format'=>'announcement','clarification_completed'=>true,'owner_id'=>'phase2c-test','run_id'=>'phase2c-generation','allow_web'=>false,'include_historical_context'=>false]);
 echo json_encode(['http'=>$r->status(),'seconds'=>round(microtime(true)-$start,2),'status'=>$r->json('status'),'article_present'=>!empty($r->json('article')),'detail'=>$r->failed()?substr($r->body(),0,700):null]).PHP_EOL;
} catch (Illuminate\Http\Client\ConnectionException $e) { echo 'Bounded request timed out or could not connect after '.round(microtime(true)-$start,2).' seconds'.PHP_EOL; }
$r=$http->get($base.'/health');echo 'FastAPI recovery health '.$r->status().PHP_EOL;
