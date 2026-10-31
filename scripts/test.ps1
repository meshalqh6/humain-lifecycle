param([switch]$Browser)
. "$PSScriptRoot\common.ps1"
Push-Location $ProjectRoot
try {
    Assert-Docker
    Invoke-Checked 'docker' @('compose','--profile','test','up','-d','--wait','postgres-test')
    Push-Location backend
    try {
        Invoke-Checked $PythonExe @('-m','pytest','-q','--junitxml=../docs/backend-results.xml')
        Invoke-Checked $PythonExe @('-m','ruff','check','app','tests')
        Invoke-Checked $PythonExe @('-m','alembic','check')
    } finally { Pop-Location }
    Push-Location frontend
    try {
        Invoke-Checked 'npm.cmd' @('run','lint')
        Invoke-Checked 'npm.cmd' @('test')
        Invoke-Checked 'npm.cmd' @('run','build')
        if ($Browser) { Invoke-Checked 'npm.cmd' @('run','test:e2e') }
    } finally { Pop-Location }
} finally {
    & $PythonExe "$ProjectRoot\scripts\sanitize_reports.py"
    Pop-Location
}
