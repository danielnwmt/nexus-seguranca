# ============================================================
#  Nexus Monitoramento — Instalador Online Windows (One-Liner)
#
#  USO (PowerShell como Administrador):
#    Set-ExecutionPolicy Bypass -Scope Process -Force; iwr -useb https://raw.githubusercontent.com/danielnwmt/bravo-seguran-a/main/installer/install-online.ps1 | iex
#
# ============================================================

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoUrl = if ($env:REPO_URL) { $env:REPO_URL } else { "https://github.com/danielnwmt/bravo-seguran-a" }
$Branch = if ($env:BRANCH) { $env:BRANCH } else { "main" }
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { "C:\NexusMonitoramento" }

Write-Host ""
Write-Host "=============================================" -ForegroundColor DarkCyan
Write-Host "   NEXUS MONITORAMENTO — Instalador Online" -ForegroundColor White
Write-Host "   Instalacao automatica via GitHub" -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor DarkCyan
Write-Host ""

# Verificar admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "  [X] Execute como Administrador!" -ForegroundColor Red
    exit 1
}

# Instalar git se necessario
$gitOk = $false
try { if (git --version 2>$null) { $gitOk = $true } } catch {}

if (-not $gitOk) {
    Write-Host ">> Instalando Git..." -ForegroundColor Cyan
    $wingetOk = $false
    try { if (winget --version 2>$null) { $wingetOk = $true } } catch {}
    
    if ($wingetOk) {
        winget install Git.Git --accept-source-agreements --accept-package-agreements --silent
    } else {
        $gitInstaller = "$env:TEMP\git-installer.exe"
        Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe" -OutFile $gitInstaller -UseBasicParsing
        Start-Process -FilePath $gitInstaller -ArgumentList "/VERYSILENT", "/NORESTART" -Wait -NoNewWindow
        Remove-Item $gitInstaller -Force -ErrorAction SilentlyContinue
    }
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "  [OK] Git instalado" -ForegroundColor Green
}

# Clonar ou atualizar repositorio
if (Test-Path "$InstallDir\.git") {
    Write-Host ">> Repositorio ja existe. Atualizando..." -ForegroundColor Green
    Set-Location $InstallDir
    git fetch origin $Branch
    git reset --hard "origin/$Branch"
} else {
    Write-Host ">> Clonando repositorio..." -ForegroundColor Cyan
    git clone --branch $Branch $RepoUrl $InstallDir
}

Set-Location $InstallDir

# Executar instalador principal
Write-Host ""
Write-Host ">> Executando instalador principal..." -ForegroundColor Cyan
Write-Host ""

powershell -ExecutionPolicy Bypass -File "$InstallDir\install-windows.ps1"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "   Instalacao online concluida!" -ForegroundColor White
Write-Host "   Para atualizar, use o botao" -ForegroundColor Gray
Write-Host "   'Atualizar Sistema' nas Configuracoes" -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
