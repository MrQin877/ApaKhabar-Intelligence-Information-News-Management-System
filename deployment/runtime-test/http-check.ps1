$ErrorActionPreference='Stop'
$base='http://127.0.0.1:8088'
$credentials=Get-Content (Join-Path $PSScriptRoot 'auth.json') -Raw | ConvertFrom-Json
$login=Invoke-WebRequest -UseBasicParsing "$base/login" -SessionVariable session
if($login.Content -notmatch 'name="csrf-token" content="([^"]+)"'){throw 'CSRF token missing'}
$csrf=$matches[1]
if($login.Content -notmatch 'data-page="([^"]+)"'){throw 'Inertia page missing'}
$initial=[System.Net.WebUtility]::HtmlDecode($matches[1]) | ConvertFrom-Json
try {
    $signed=Invoke-WebRequest -UseBasicParsing "$base/login" -Method Post -WebSession $session -Headers @{Accept='application/json'} -Body @{email=$credentials.email;password=$credentials.password;_token=$csrf}
    $admin=Invoke-WebRequest -UseBasicParsing "$base/admin/dashboard" -WebSession $session -Headers @{'X-Inertia'='true';'X-Inertia-Version'=$initial.version;Accept='application/json'}
    $page=$admin.Content | ConvertFrom-Json
    [PSCustomObject]@{LoginStatus=[int]$signed.StatusCode;AdminStatus=[int]$admin.StatusCode;InertiaComponent=$page.component}
    $assets=[regex]::Matches($login.Content,'(?:src|href)="([^\"]*/build/assets/[^\"]+)"')
    foreach($asset in $assets){$url=$asset.Groups[1].Value; if($url.StartsWith('/')){$url=$base+$url}; $result=Invoke-WebRequest -UseBasicParsing $url; [PSCustomObject]@{Asset=([uri]$url).AbsolutePath;Status=[int]$result.StatusCode}}
    $public=Invoke-WebRequest -UseBasicParsing "$base/storage/phase2b-check.txt"
    [PSCustomObject]@{PublicMedia=[int]$public.StatusCode;ContentCorrect=($public.Content -eq 'Docker isolated storage test')}
    try {Invoke-WebRequest -UseBasicParsing "$base/storage/app/private/phase2b-check.txt" | Out-Null; throw 'Private media exposed'} catch {if($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -in @(403,404)){'Private media: access denied (not publicly exposed)'}else{throw}}
} catch {
    if($_.Exception.Response){throw ('HTTP test failed with status '+[int]$_.Exception.Response.StatusCode)}
    throw
}
