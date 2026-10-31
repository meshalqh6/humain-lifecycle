. "$PSScriptRoot\common.ps1"
Push-Location $ProjectRoot
try {
    foreach ($program in 'python','node','npm.cmd','ollama') {
        if (-not (Get-Command $program -ErrorAction SilentlyContinue)) { throw "Missing prerequisite: $program. Install it and restart PowerShell." }
    }
    Assert-Docker
    Invoke-Checked 'docker' @('compose','version')
    Invoke-Checked 'python' @('scripts/init_env.py')
    if (-not (Test-Path -LiteralPath $PythonExe)) { Invoke-Checked 'python' @('-m','venv','.venv') }
    Invoke-Checked $PythonExe @('-m','pip','install','-r','backend/requirements.lock.txt')
    Invoke-Checked 'docker' @('compose','up','-d','--wait','postgres','mailpit')
    Push-Location backend
    try { Invoke-Checked $PythonExe @('-m','alembic','upgrade','head'); Invoke-Checked $PythonExe @('-m','app.seed') } finally { Pop-Location }
    Push-Location frontend
    try { Invoke-Checked 'npm.cmd' @('ci','--no-audit','--no-fund') } finally { Pop-Location }
    Invoke-Checked 'ollama' @('list')
    Write-Host 'Setup complete. No models downloaded. Configure OLLAMA_MODEL in .env to an installed Qwen model.'
    Write-Host 'Sign in as admin using ADMIN_PASSWORD from the ignored local .env. Start with scripts/start.ps1.'
} finally { Pop-Location }
