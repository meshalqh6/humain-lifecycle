$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$PythonExe = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE). See output above." }
}
function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Install Docker Desktop for Windows and enable the WSL2 engine.' }
    & docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running. Start Docker Desktop, wait for the engine, then retry.' }
}
function Wait-Http {
    param([string]$Url)
    for ($i=0; $i -lt 60; $i++) {
        try { $null=Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2; return } catch { Start-Sleep -Seconds 1 }
    }
    throw "Service failed to become ready: $Url. Inspect runtime logs."
}
