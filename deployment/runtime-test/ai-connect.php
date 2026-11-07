<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$base=rtrim(config('services.apakhabar_ai.url'), '/');
$http=Illuminate\Support\Facades\Http::timeout(10);
$health=$http->get($base.'/health');
$unauthorized=Illuminate\Support\Facades\Http::timeout(10)->get($base.'/openapi.json');
$authorized=Illuminate\Support\Facades\Http::timeout(10)->withHeaders(['X-ApaKhabar-Service-Token'=>config('services.apakhabar_ai.token')])->get($base.'/openapi.json');
echo json_encode(['health'=>$health->status(),'without_token'=>$unauthorized->status(),'with_token'=>$authorized->status()]).PHP_EOL;
if ($health->status()!==200 || $unauthorized->status()!==401 || $authorized->status()!==200) { exit(1); }
