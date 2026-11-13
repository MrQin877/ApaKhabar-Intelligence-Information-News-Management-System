# Windows local development only. Does not alter .env, volumes, or production files.
[CmdletBinding()]
param(
    [switch]$Build,
    [switch]$LocalhostOnly,
    [switch]$CheckOnly,
    [string]$InterfaceAlias
)

$ErrorActionPreference = 'Stop'

function Get-LanAddress {
    # HardwareInterface excludes Hyper-V/WSL/Docker/VPN devices even if they
    # advertise an Ethernet interface type. Never guess when discovery fails.
    $adapters = @(Get-NetAdapter -Physical -ErrorAction Stop | Where-Object {
        $_.Status -eq 'Up' -and $_.HardwareInterface -and
        $_.InterfaceDescription -notmatch 'Virtual|VPN|TAP|TUN|WireGuard|Docker|Hyper-V|WSL|Loopback' -and
        (-not $InterfaceAlias -or $_.Name -eq $InterfaceAlias)
    })
    $candidates = @(foreach ($adapter in $adapters) {
        $ipInterface = Get-NetIPInterface -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction Stop
        $routes = @(Get-NetRoute -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue)
        # Disconnected/unrouted adapters are not appropriate LAN defaults.
        if ($routes.Count -eq 0) { continue }
        $routeMetric = ($routes | Measure-Object RouteMetric -Minimum).Minimum
        foreach ($address in @(Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction Stop)) {
            if ($address.AddressState -ne 'Preferred' -or $address.SkipAsSource -or
                $address.IPAddress -match '^(127\.|169\.254\.|0\.)') { continue }
            [pscustomobject]@{
                Address = $address.IPAddress
                Adapter = $adapter.Name
                Metric = [int]$ipInterface.InterfaceMetric + [int]$routeMetric
                Index = $adapter.ifIndex
            }
        }
    })
    $candidates | Sort-Object Metric, Index, Address | Select-Object -First 1
}

function Get-LocalComposeConfig([string[]]$ComposeArgs, [string]$LanAddress) {
    # Keep resolved credentials in memory; never print or save full config.
    $json = & docker @ComposeArgs config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Compose validation failed. No containers were started.' }
    $config = ($json -join "`n") | ConvertFrom-Json
    $ports = @($config.services.web.ports)
    $expectedHosts = @('127.0.0.1')
    if ($LanAddress) { $expectedHosts += $LanAddress }
    if ($ports.Count -ne $expectedHosts.Count) { throw 'Unexpected or duplicate Nginx port mappings.' }
    foreach ($hostAddress in $expectedHosts) {
        $matchesForHost = @($ports | Where-Object {
            $_.host_ip -eq $hostAddress -and $_.target -eq 80 -and $_.protocol -eq 'tcp'
        })
        if ($matchesForHost.Count -ne 1) { throw "Invalid Nginx binding for $hostAddress" }
    }
    if (@($ports | Select-Object -ExpandProperty published -Unique).Count -ne 1) {
        throw 'Nginx bindings must use the same published port.'
    }
    foreach ($service in $config.services.PSObject.Properties) {
        if ($service.Name -ne 'web' -and $service.Value.ports) {
            throw "Internal service $($service.Name) unexpectedly publishes ports."
        }
    }
    Write-Host 'Validated Nginx bindings:'
    foreach ($port in $ports) { Write-Host "  $($port.host_ip):$($port.published) -> 80/tcp" }
    return $config
}

function Show-LocalUrls($Config, [string]$LanAddress) {
    $port = $Config.services.web.ports[0].published
    Write-Host "Website: http://localhost:$port"
    Write-Host "API:     http://localhost:$port/api"
    if ($LanAddress) {
        Write-Host "LAN website: http://${LanAddress}:$port"
        Write-Host "LAN API:     http://${LanAddress}:$port/api"
    }
}

$previousLan = [Environment]::GetEnvironmentVariable('LAN_IP', 'Process')
try {
    Get-Command docker -ErrorAction Stop | Out-Null
    $composeArgs = @('compose', '--project-directory', $PSScriptRoot,
        '--env-file', (Join-Path $PSScriptRoot '.env'), '-f', (Join-Path $PSScriptRoot 'compose.yaml'))
    $baseArgs = $composeArgs.Clone()
    $lanAddress = $null
    if (-not $LocalhostOnly) {
        try {
            $selected = Get-LanAddress
            if ($selected) {
                $lanAddress = $selected.Address
                Write-Host "Detected LAN IPv4: $lanAddress ($($selected.Adapter))"
            } else { Write-Warning 'No active physical LAN/Wi-Fi IPv4 with a default route found; using localhost only.' }
        } catch { Write-Warning "LAN discovery unavailable; using localhost only. $($_.Exception.Message)" }
    }
    if ($lanAddress) {
        $env:LAN_IP = $lanAddress
        $composeArgs += @('-f', (Join-Path $PSScriptRoot 'compose.lan.yaml'))
    }
    $config = Get-LocalComposeConfig $composeArgs $lanAddress
    if ($CheckOnly) {
        Write-Host 'Configuration checked; no containers changed. Planned URLs:'
        Show-LocalUrls $config $lanAddress
        return
    }
    # A stopped/unresponsive Desktop engine can otherwise leave `docker info`
    # waiting indefinitely. This read-only probe must finish before any `up`.
    $probe = New-Object System.Diagnostics.Process
    $probe.StartInfo.FileName = (Get-Command docker -CommandType Application | Select-Object -First 1).Source
    $probe.StartInfo.Arguments = 'info --format {{.OSType}}'
    $probe.StartInfo.UseShellExecute = $false
    $probe.StartInfo.CreateNoWindow = $true
    $probe.StartInfo.RedirectStandardOutput = $true
    $probe.StartInfo.RedirectStandardError = $true
    try {
        [void]$probe.Start()
        if (-not $probe.WaitForExit(30000)) {
            $probe.Kill()
            throw 'Docker Engine did not respond within 30 seconds. Start/check Docker Desktop with Linux containers and retry.'
        }
        if ($probe.ExitCode -ne 0 -or $probe.StandardOutput.ReadToEnd().Trim() -ne 'linux') {
            throw 'Docker Engine is unavailable or is not using Linux containers. Start/check Docker Desktop and retry.'
        }
    } finally { $probe.Dispose() }
    $upArgs = @('up', '-d', '--no-build')
    if ($Build) { $upArgs = @('up', '-d', '--build') }
    # Capture output for a narrowly scoped retry, then display it normally.
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $output = & docker @composeArgs @upArgs 2>&1; $upExit = $LASTEXITCODE }
    finally { $ErrorActionPreference = $savedPreference }
    $output | ForEach-Object { Write-Host "$_" }
    if ($upExit -ne 0 -and $lanAddress -and
        ($output -join "`n") -match 'cannot assign requested address|requested address is not valid|ports are not available|port is already allocated|address already in use|failed to bind|bind:') {
        Write-Warning 'Docker rejected the LAN binding (IP changed, unavailable, or port in use). Retrying with localhost only.'
        $lanAddress = $null
        $composeArgs = $baseArgs
        $config = Get-LocalComposeConfig $composeArgs $null
        & docker @composeArgs @upArgs
        $upExit = $LASTEXITCODE
    }
    if ($upExit -ne 0) { throw 'Docker startup failed. See Docker output above; no containers or volumes were deleted.' }
    Write-Host 'ApaKhabar started (services may still be warming up).'
    Show-LocalUrls $config $lanAddress
    & docker @composeArgs ps
} finally {
    [Environment]::SetEnvironmentVariable('LAN_IP', $previousLan, 'Process')
}
