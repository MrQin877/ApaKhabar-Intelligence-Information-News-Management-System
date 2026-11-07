$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $PSScriptRoot 'runtime-test'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$settings = @{}
foreach ($line in Get-Content (Join-Path $root '.env')) {
    if ($line -match '^(DB_[A-Z_]+)=(.*)$') {
        $settings[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
}
if ($settings.DB_HOST -notin @('127.0.0.1', 'localhost')) { throw 'Expected a local XAMPP database.' }
if ($settings.DB_DATABASE -notmatch '^[a-zA-Z0-9_]+$') { throw 'Unexpected source database name.' }
$cnf = Join-Path $out 'source-client.cnf'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dump = Join-Path $out "xampp-$stamp.sql"
function Quote-Option($value) { return '"' + $value.Replace('\', '\\').Replace('"', '\"') + '"' }
$options = @('[client]', 'protocol=tcp', 'host=127.0.0.1', "port=$($settings.DB_PORT)", ('user=' + (Quote-Option $settings.DB_USERNAME)), ('password=' + (Quote-Option $settings.DB_PASSWORD)))
[IO.File]::WriteAllLines($cnf, $options, (New-Object Text.UTF8Encoding($false)))
$mysql = 'C:\Testxampp\mysql\bin\mysql.exe'
$mysqldump = 'C:\Testxampp\mysql\bin\mysqldump.exe'
try {
    $tables = & $mysql "--defaults-extra-file=$cnf" --batch --skip-column-names $settings.DB_DATABASE -e "SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;"
    if ($LASTEXITCODE -ne 0) { throw 'Source metadata query failed.' }
    $selects = foreach ($row in $tables) {
        $table, $engine = $row -split "`t"
        if ($engine -ne 'InnoDB' -or $table -notmatch '^[a-zA-Z0-9_]+$') { throw 'Nontransactional or unexpected table detected; export stopped.' }
        "SELECT '$table' AS table_name, COUNT(*) AS row_count FROM ``$table``"
    }
    $query = 'START TRANSACTION WITH CONSISTENT SNAPSHOT; ' + ($selects -join ' UNION ALL ') + '; COMMIT;'
    $before = & $mysql "--defaults-extra-file=$cnf" --batch --skip-column-names $settings.DB_DATABASE -e $query
    if ($LASTEXITCODE -ne 0) { throw 'Source counts failed.' }
    & $mysqldump "--defaults-extra-file=$cnf" --single-transaction --skip-lock-tables --skip-add-locks --hex-blob --default-character-set=utf8mb4 "--result-file=$dump" $settings.DB_DATABASE
    if ($LASTEXITCODE -ne 0) { throw 'Export failed.' }
    $after = & $mysql "--defaults-extra-file=$cnf" --batch --skip-column-names $settings.DB_DATABASE -e $query
    if ($LASTEXITCODE -ne 0 -or (Compare-Object $before $after)) { throw 'Source row counts changed during export; verification required before import.' }
    [IO.File]::WriteAllLines((Join-Path $out 'source-counts.tsv'), $after)
    [IO.File]::WriteAllText((Join-Path $out 'counts.sql'), ($selects -join ' UNION ALL ') + ';')
    [IO.File]::WriteAllText((Join-Path $out 'backup-path.txt'), $dump)
    $hash = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash
    [IO.File]::WriteAllText((Join-Path $out 'backup.sha256'), $hash)
    [PSCustomObject]@{Tables=$tables.Count; BackupBytes=(Get-Item $dump).Length; StableCounts=$true; SHA256=$hash}
} finally {
    Remove-Item -LiteralPath $cnf -ErrorAction SilentlyContinue
}
