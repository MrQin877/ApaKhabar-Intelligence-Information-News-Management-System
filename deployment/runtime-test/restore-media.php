<?php
$manifest=json_decode(file_get_contents('/tmp/phase2c-media.json'),true);
foreach($manifest as $item){
    $path=$item['path'];
    if(str_contains($path,'..')||str_starts_with($path,'/')){throw new RuntimeException('Unsafe path');}
    $src='/tmp/phase2c-media/'.$path;$dst='/var/www/html/storage/app/'.$path;
    if(hash_file('sha256',$src)!==$item['sha256']){throw new RuntimeException('Snapshot hash mismatch');}
    if(file_exists($dst) && hash_file('sha256',$dst)!==$item['sha256']){throw new RuntimeException('Conflicting Docker media; restore stopped');}
}
foreach($manifest as $item){
    $src='/tmp/phase2c-media/'.$item['path'];$dst='/var/www/html/storage/app/'.$item['path'];
    if(!file_exists($dst)){if(!is_dir(dirname($dst))){mkdir(dirname($dst),0775,true);}if(!copy($src,$dst)){throw new RuntimeException('Copy failed');}}
    if(hash_file('sha256',$dst)!==$item['sha256']){throw new RuntimeException('Restored hash mismatch');}
}
echo count($manifest)." media files restored and SHA256 verified; no conflicting files overwritten\n";
