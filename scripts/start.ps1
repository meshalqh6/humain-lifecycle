. "$PSScriptRoot\common.ps1"
Push-Location $ProjectRoot
try {
    Assert-Docker
    foreach ($Port in 8000,5173) {
        $Probe=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$Port)
        $Probe.ExclusiveAddressUse=$true
        try { $Probe.Start() } catch { throw "Port $Port is already in use. Stop the existing service before starting." } finally { $Probe.Stop() }
    }
    if (-not (Test-Path -LiteralPath $PythonExe)) { throw 'Run scripts/setup.ps1 first.' }
    Invoke-Checked 'docker' @('compose','up','-d','--wait','postgres','mailpit')
    $RuntimePath=Join-Path $ProjectRoot 'runtime'
    $null=New-Item -ItemType Directory -Path $RuntimePath -Force
    $PidPath=Join-Path $RuntimePath 'processes.json'
    if (Test-Path -LiteralPath $PidPath) {
        $prior=Get-Content -LiteralPath $PidPath -Raw | ConvertFrom-Json
        if (($prior | Where-Object { Get-Process -Id $_.id -ErrorAction SilentlyContinue }).Count -gt 0) { throw 'A managed service is already running. Run scripts/stop.ps1 before starting again.' }
    }
    Push-Location backend
    try { Invoke-Checked $PythonExe @('-m','alembic','upgrade','head') } finally { Pop-Location }
    $BackendProcess=Start-Process -FilePath $PythonExe -ArgumentList '-m app.run' -WorkingDirectory "$ProjectRoot\backend" -WindowStyle Hidden -RedirectStandardOutput "$RuntimePath\backend.log" -RedirectStandardError "$RuntimePath\backend-error.log" -PassThru
    $Records=@(@{id=$BackendProcess.Id;start=$BackendProcess.StartTime.ToUniversalTime().ToString('o');name='backend'})
    $Records | ConvertTo-Json | Set-Content -LiteralPath $PidPath
    Wait-Http 'http://127.0.0.1:8000/api/health/database'
    $NodeExe=(Get-Command node).Source
    $FrontendProcess=Start-Process -FilePath $NodeExe -ArgumentList 'node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort' -WorkingDirectory "$ProjectRoot\frontend" -WindowStyle Hidden -RedirectStandardOutput "$RuntimePath\frontend.log" -RedirectStandardError "$RuntimePath\frontend-error.log" -PassThru
    $Records+=@{id=$FrontendProcess.Id;start=$FrontendProcess.StartTime.ToUniversalTime().ToString('o');name='frontend'}
    $Records | ConvertTo-Json | Set-Content -LiteralPath $PidPath
    Wait-Http 'http://127.0.0.1:5173'
    $ModelState=Invoke-RestMethod 'http://127.0.0.1:8000/api/health/ollama'
    Write-Host "Ollama ready: $($ModelState.ready), model: $($ModelState.model)"
    Write-Host 'Application: http://127.0.0.1:5173'
    Write-Host 'API docs: http://127.0.0.1:8000/docs'
    Write-Host 'Sandbox inbox: http://127.0.0.1:8025'
} finally { Pop-Location }
