. "$PSScriptRoot\common.ps1"
Assert-Docker
Push-Location $ProjectRoot
try {
    $BackupDir=Join-Path $ProjectRoot 'runtime\backups'
    $null=New-Item -ItemType Directory -Path $BackupDir -Force
    $Name='humain-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.dump'
    Invoke-Checked 'docker' @('compose','exec','-T','postgres','sh','-c','pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/humain.dump')
    Invoke-Checked 'docker' @('compose','cp','postgres:/tmp/humain.dump',"$BackupDir\$Name")
    Write-Host "Backup saved: $BackupDir\$Name"
} finally { Pop-Location }
