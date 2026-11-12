$ErrorActionPreference='Stop'
$root=(Resolve-Path 'storage/app').Path
$manifest=@(Get-ChildItem $root -Recurse -File | ForEach-Object { @{path=$_.FullName.Substring($root.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
$manifest | ConvertTo-Json | Set-Content deployment/runtime-test/media-manifest.json
tar -cf deployment/runtime-test/media-copy.tar -C storage/app .
if($LASTEXITCODE){throw 'Media snapshot failed'}
foreach($item in $manifest){if((Get-FileHash -LiteralPath (Join-Path $root $item.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256){throw 'Live media changed during snapshot'}}
docker cp deployment/runtime-test/media-copy.tar apakhabar-docker-app-1:/tmp/phase2c-media.tar
docker cp deployment/runtime-test/media-manifest.json apakhabar-docker-app-1:/tmp/phase2c-media.json
docker exec apakhabar-docker-app-1 mkdir -p /tmp/phase2c-media
docker exec apakhabar-docker-app-1 tar -xf /tmp/phase2c-media.tar -C /tmp/phase2c-media
docker cp deployment/runtime-test/restore-media.php apakhabar-docker-app-1:/tmp/phase2c-restore.php
docker exec --user www-data apakhabar-docker-app-1 php /tmp/phase2c-restore.php
if($LASTEXITCODE){throw 'Media restore verification failed'}
