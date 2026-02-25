#Requires -RunAsAdministrator
# ============================================================
#  Bravo Monitoramento — Instalador Windows Server
#  Execute como Administrador:
#    powershell -ExecutionPolicy Bypass -File install-windows.ps1
# ============================================================

param(
    [string]$InstallDir = "C:\BravoMonitoramento",
    [int]$Port = 80,
    [string]$SupabaseUrl = "",
    [string]$SupabaseKey = "",
    [string]$SupabaseProjectId = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step($msg) { Write-Host "`n🔹 $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠️  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  ❌ $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "=============================================" -ForegroundColor DarkCyan
Write-Host "   BRAVO MONITORAMENTO — Instalador Windows" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor DarkCyan
Write-Host ""

# ----------------------------------------------------------
# 1. Verificar/Instalar Node.js
# ----------------------------------------------------------
Write-Step "Verificando Node.js..."

$nodeVersion = $null
try { $nodeVersion = (node -v 2>$null) } catch {}

if ($nodeVersion) {
    Write-Ok "Node.js encontrado: $nodeVersion"
} else {
    Write-Warn "Node.js nao encontrado. Instalando via winget..."
    try {
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $nodeVersion = (node -v)
        Write-Ok "Node.js instalado: $nodeVersion"
    } catch {
        Write-Err "Falha ao instalar Node.js. Instale manualmente: https://nodejs.org"
        exit 1
    }
}

# ----------------------------------------------------------
# 2. Criar diretorio de instalacao
# ----------------------------------------------------------
Write-Step "Preparando diretorio de instalacao: $InstallDir"

if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Write-Ok "Diretorio criado"
} else {
    Write-Ok "Diretorio ja existe"
}

# ----------------------------------------------------------
# 3. Copiar arquivos do projeto
# ----------------------------------------------------------
Write-Step "Copiando arquivos do projeto..."

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($scriptDir -ne $InstallDir) {
    $excludes = @("node_modules", ".git", "dist")
    Get-ChildItem -Path $scriptDir -Exclude $excludes | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $InstallDir -Recurse -Force
    }
    Write-Ok "Arquivos copiados para $InstallDir"
} else {
    Write-Ok "Ja no diretorio de instalacao"
}

Set-Location $InstallDir

# ----------------------------------------------------------
# 4. Configurar variaveis de ambiente (.env)
# ----------------------------------------------------------
Write-Step "Configurando variaveis de ambiente..."

if (!$SupabaseUrl -or !$SupabaseKey -or !$SupabaseProjectId) {
    Write-Host ""
    Write-Host "  Configure as credenciais do banco de dados:" -ForegroundColor White
    if (!$SupabaseUrl)       { $SupabaseUrl       = Read-Host "  SUPABASE_URL" }
    if (!$SupabaseKey)       { $SupabaseKey       = Read-Host "  SUPABASE_ANON_KEY" }
    if (!$SupabaseProjectId) { $SupabaseProjectId = Read-Host "  SUPABASE_PROJECT_ID" }
}

$envContent = @"
VITE_SUPABASE_URL="$SupabaseUrl"
VITE_SUPABASE_PUBLISHABLE_KEY="$SupabaseKey"
VITE_SUPABASE_PROJECT_ID="$SupabaseProjectId"
"@

Set-Content -Path ".env" -Value $envContent -Encoding UTF8
Write-Ok "Arquivo .env criado"

# ----------------------------------------------------------
# 5. Instalar dependencias
# ----------------------------------------------------------
Write-Step "Instalando dependencias (npm install)..."

npm install --legacy-peer-deps 2>&1 | Out-Null
Write-Ok "Dependencias instaladas"

# ----------------------------------------------------------
# 6. Build do projeto
# ----------------------------------------------------------
Write-Step "Gerando build de producao..."

npm run build 2>&1 | Out-Null

if (Test-Path "dist\index.html") {
    Write-Ok "Build concluido com sucesso"
} else {
    Write-Err "Build falhou. Execute 'npm run build' manualmente para ver os erros."
    exit 1
}

# ----------------------------------------------------------
# 7. Instalar 'serve' para servir os arquivos
# ----------------------------------------------------------
Write-Step "Instalando servidor web (serve)..."

npm install -g serve 2>&1 | Out-Null
Write-Ok "Servidor 'serve' instalado globalmente"

# ----------------------------------------------------------
# 8. Criar script de inicializacao
# ----------------------------------------------------------
Write-Step "Criando script de inicializacao..."

$startScript = @"
@echo off
title Bravo Monitoramento
echo.
echo =============================================
echo   BRAVO MONITORAMENTO - Servidor Web
echo =============================================
echo.
echo Servidor rodando em: http://localhost:$Port
echo Pressione Ctrl+C para parar.
echo.
cd /d "$InstallDir"
serve -s dist -l $Port
"@

Set-Content -Path "$InstallDir\iniciar-bravo.bat" -Value $startScript -Encoding ASCII
Write-Ok "Script criado: iniciar-bravo.bat"

# ----------------------------------------------------------
# 9. Criar servico Windows (NSSM) - opcional
# ----------------------------------------------------------
Write-Step "Configurando servico Windows..."

$nssmPath = $null
try { $nssmPath = (Get-Command nssm -ErrorAction SilentlyContinue).Source } catch {}

if ($nssmPath) {
    nssm stop BravoMonitoramento 2>$null
    nssm remove BravoMonitoramento confirm 2>$null

    $servePath = (Get-Command serve).Source
    nssm install BravoMonitoramento $servePath "-s dist -l $Port"
    nssm set BravoMonitoramento AppDirectory $InstallDir
    nssm set BravoMonitoramento DisplayName "Bravo Monitoramento"
    nssm set BravoMonitoramento Description "Sistema de monitoramento de cameras"
    nssm set BravoMonitoramento Start SERVICE_AUTO_START
    nssm start BravoMonitoramento

    Write-Ok "Servico Windows 'BravoMonitoramento' criado e iniciado"
    Write-Ok "O servico inicia automaticamente com o Windows"
} else {
    Write-Warn "NSSM nao encontrado. Para criar um servico Windows automatico:"
    Write-Host "  1. Baixe NSSM: https://nssm.cc/download" -ForegroundColor Gray
    Write-Host "  2. Extraia e coloque nssm.exe no PATH" -ForegroundColor Gray
    Write-Host "  3. Execute este instalador novamente" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Enquanto isso, use 'iniciar-bravo.bat' para iniciar manualmente." -ForegroundColor Gray
}

# ----------------------------------------------------------
# 10. Criar atalho na Area de Trabalho
# ----------------------------------------------------------
Write-Step "Criando atalho na Area de Trabalho..."

$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Bravo Monitoramento.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "http://localhost:$Port"
$shortcut.IconLocation = "$InstallDir\dist\favicon.ico,0"
$shortcut.Description = "Abrir Bravo Monitoramento"
$shortcut.Save()

Write-Ok "Atalho criado na Area de Trabalho"

# ----------------------------------------------------------
# Resumo Final
# ----------------------------------------------------------
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "   INSTALACAO CONCLUIDA COM SUCESSO!" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  📁 Diretorio: $InstallDir" -ForegroundColor White
Write-Host "  🌐 Acesso:    http://localhost:$Port" -ForegroundColor White
Write-Host "  🔑 Login:     admin@bravo.com" -ForegroundColor White
Write-Host ""
Write-Host "  Comandos uteis:" -ForegroundColor Gray
Write-Host "    Iniciar:  iniciar-bravo.bat" -ForegroundColor Gray
Write-Host "    Rebuild:  npm run build" -ForegroundColor Gray
Write-Host ""

# Abrir no navegador
Start-Process "http://localhost:$Port"
