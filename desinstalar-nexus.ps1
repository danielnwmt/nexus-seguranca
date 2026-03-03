#Requires -RunAsAdministrator
# ============================================================
#  Nexus Monitoramento — Desinstalador Windows
# ============================================================

param(
    [string]$InstallDir = "C:\NexusMonitoramento"
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Red
Write-Host "   NEXUS MONITORAMENTO — Desinstalar" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Deseja remover o Nexus Monitoramento? (s/n)"
if ($confirm -ne "s") {
    Write-Host "Cancelado." -ForegroundColor Yellow
    exit 0
}

# Parar e remover servico
Write-Host "Parando servico..." -ForegroundColor Cyan
nssm stop NexusMonitoramento 2>$null
nssm remove NexusMonitoramento confirm 2>$null

# Remover atalho
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Nexus Monitoramento.lnk"
if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
    Write-Host "  ✅ Atalho removido" -ForegroundColor Green
}

# Remover diretorio
if (Test-Path $InstallDir) {
    Remove-Item $InstallDir -Recurse -Force
    Write-Host "  ✅ Diretorio removido: $InstallDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "Nexus Monitoramento desinstalado com sucesso." -ForegroundColor Green
Write-Host ""
