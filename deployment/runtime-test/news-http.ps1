$ErrorActionPreference='Stop'
$base='http://127.0.0.1:8088'
$c=Get-Content (Join-Path $PSScriptRoot 'auth.json') -Raw|ConvertFrom-Json
$r=Invoke-WebRequest -UseBasicParsing "$base/login" -SessionVariable session
$csrf=[regex]::Match($r.Content,'name="csrf-token" content="([^"]+)"').Groups[1].Value
Invoke-WebRequest -UseBasicParsing "$base/login" -WebSession $session -Method Post -Headers @{Accept='application/json'} -Body @{email=$c.email;password=$c.password;_token=$csrf}|Out-Null
$r=Invoke-WebRequest -UseBasicParsing "$base/admin/news/manual/create" -WebSession $session
$page=[System.Net.WebUtility]::HtmlDecode([regex]::Match($r.Content,'data-page="([^"]+)"').Groups[1].Value)|ConvertFrom-Json
$csrf=[regex]::Match($r.Content,'name="csrf-token" content="([^"]+)"').Groups[1].Value
$headers=@{Accept='application/json';'X-CSRF-TOKEN'=$csrf}
$data=@{headline='Phase2C disposable website news';content='<p>This isolated Docker test checks saving and website-only publication without social publishing.</p>';content_format='html';category_id=$page.props.categories[0].id;intent='draft';show_on_homepage=$false}
if(-not $data.category_id){$data.category_id=$page.props.categories[0].categoryID}
$save=Invoke-WebRequest -UseBasicParsing "$base/admin/news/manual" -Method Post -WebSession $session -Headers $headers -ContentType 'application/json' -Body ($data|ConvertTo-Json)
$id=($save.Content|ConvertFrom-Json).draft.id
Set-Content (Join-Path $PSScriptRoot 'news-draft-id.txt') $id
$data.headline='Phase2C disposable website news edited'
$edit=Invoke-WebRequest -UseBasicParsing "$base/admin/news/manual/$id" -Method Put -WebSession $session -Headers $headers -ContentType 'application/json' -Body ($data|ConvertTo-Json)
$data.intent='publish';$data.platforms=@('website')
$publish=Invoke-WebRequest -UseBasicParsing "$base/admin/news/manual/$id" -Method Put -WebSession $session -Headers $headers -ContentType 'application/json' -Body ($data|ConvertTo-Json)
$result=$publish.Content|ConvertFrom-Json
[PSCustomObject]@{Saved=[int]$save.StatusCode;Edited=[int]$edit.StatusCode;Published=[int]$publish.StatusCode;WebsiteSuccess=$result.results.application.success;DraftId=$id}|ConvertTo-Json
if(-not $result.results.application.success){throw 'Website-only publication failed'}
