param([switch]$StopDatabase)
. "$PSScriptRoot\common.ps1"
$PidPath=Join-Path $ProjectRoot 'runtime\processes.json'
function Stop-OwnedTree {
    param([int]$OwnedId)
    $Children=Get-CimInstance Win32_Process -Filter "ParentProcessId = $OwnedId" -ErrorAction SilentlyContinue
    foreach ($Child in $Children) { Stop-OwnedTree -OwnedId $Child.ProcessId }
    Stop-Process -Id $OwnedId -ErrorAction SilentlyContinue
    Wait-Process -Id $OwnedId -Timeout 10 -ErrorAction SilentlyContinue
}
if (Test-Path -LiteralPath $PidPath) {
    $Records=Get-Content -LiteralPath $PidPath -Raw | ConvertFrom-Json
    foreach ($record in $Records) {
        $Process=Get-Process -Id $record.id -ErrorAction SilentlyContinue
        # Refuse to kill a reused PID belonging to another process.
        if ($Process -and [Math]::Abs(($Process.StartTime.ToUniversalTime() - ([datetimeoffset]$record.start).UtcDateTime).TotalSeconds) -lt 2) {
            if ($record.name -eq 'backend') {
                $ShutdownFile=Join-Path $ProjectRoot 'runtime\shutdown.request'
                Set-Content -LiteralPath $ShutdownFile -Value 'stop'
                for ($i=0; $i -lt 25; $i++) {
                    if (-not (Get-Process -Id $record.id -ErrorAction SilentlyContinue)) { break }
                    Start-Sleep -Seconds 1
                }
            }
            $Process=Get-Process -Id $record.id -ErrorAction SilentlyContinue
            if (-not $Process) { continue }
            if (-not $Process.CloseMainWindow()) { Stop-OwnedTree -OwnedId $Process.Id }
        }
    }
    Remove-Item -LiteralPath $PidPath
}
if ($StopDatabase) {
    Push-Location $ProjectRoot
    try { Invoke-Checked 'docker' @('compose','stop','postgres','mailpit') } finally { Pop-Location }
}
Write-Host 'Managed local services stopped. PostgreSQL volumes preserved.'
