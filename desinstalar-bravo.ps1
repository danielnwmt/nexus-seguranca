#Requires -RunAsAdministrator
# ============================================================
#  Bravo Monitoramento — Desinstalador Windows
# ============================================================

param(
    [string]$InstallDir = "C:\BravoMonitoramento"
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Red
Write-Host "   BRAVO MONITORAMENTO — Desinstalar" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Deseja remover o Bravo Monitoramento? (s/n)"
if ($confirm -ne "s") {
    Write-Host "Cancelado." -ForegroundColor Yellow
    exit 0
}

# Parar e remover servico
Write-Host "Parando servico..." -ForegroundColor Cyan
nssm stop BravoMonitoramento 2>$null
nssm remove BravoMonitoramento confirm 2>$null

# Remover atalho
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Bravo Monitoramento.lnk"
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
Write-Host "Bravo Monitoramento desinstalado com sucesso." -ForegroundColor Green
Write-Host ""
