#Requires -RunAsAdministrator
# ============================================================
#  Bravo Monitoramento — Instalador Completo Windows
#  Instala: Docker + Supabase + Frontend
#  Execute como Administrador:
#    powershell -ExecutionPolicy Bypass -File install-windows.ps1
# ============================================================

param(
    [string]$InstallDir = "C:\BravoMonitoramento",
    [string]$SupabaseDir = "C:\Supabase",
    [int]$Port = 80,
    [int]$SupabasePort = 8000,
    [string]$SupabaseUrl = "",
    [string]$SupabaseKey = "",
    [string]$SupabaseProjectId = "",
    [switch]$SkipDatabase
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [X] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "=============================================" -ForegroundColor DarkCyan
Write-Host "   BRAVO MONITORAMENTO — Instalador Windows" -ForegroundColor White
Write-Host "   Frontend + Banco de Dados" -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor DarkCyan
Write-Host ""

# ----------------------------------------------------------
# 0. Perguntar modo de instalação
# ----------------------------------------------------------
if (!$SkipDatabase -and !$SupabaseUrl) {
    Write-Host "  Escolha o modo de instalacao:" -ForegroundColor White
    Write-Host "  [1] Completo (Banco de dados + Frontend nesta maquina)" -ForegroundColor Gray
    Write-Host "  [2] Apenas Frontend (Banco de dados em outro servidor)" -ForegroundColor Gray
    Write-Host ""
    $mode = Read-Host "  Opcao (1 ou 2)"

    if ($mode -eq "2") {
        $SkipDatabase = $true
    }
}

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
# 2. Instalar banco de dados (Supabase Self-Hosted)
# ----------------------------------------------------------
if (!$SkipDatabase) {
    # ---- Docker Desktop ----
    Write-Step "Verificando Docker..."

    $dockerOk = $false
    try {
        $dockerVer = docker --version 2>$null
        if ($dockerVer) {
            Write-Ok "Docker encontrado: $dockerVer"
            $dockerOk = $true
        }
    } catch {}

    if (!$dockerOk) {
        Write-Warn "Docker nao encontrado. Instalando automaticamente..."

        # Tentar via winget primeiro
        $wingetOk = $false
        try {
            $wingetVer = winget --version 2>$null
            if ($wingetVer) { $wingetOk = $true }
        } catch {}

        if ($wingetOk) {
            Write-Host "  Instalando Docker Desktop via winget..." -ForegroundColor Gray
            winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements --silent
        } else {
            # Download direto do instalador
            Write-Host "  Baixando Docker Desktop..." -ForegroundColor Gray
            $dockerInstaller = "$env:TEMP\DockerDesktopInstaller.exe"
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" -OutFile $dockerInstaller -UseBasicParsing
            Write-Host "  Instalando Docker Desktop (isso pode levar alguns minutos)..." -ForegroundColor Gray
            Start-Process -FilePath $dockerInstaller -ArgumentList "install", "--quiet", "--accept-license" -Wait -NoNewWindow
            Remove-Item $dockerInstaller -Force -ErrorAction SilentlyContinue
        }

        # Atualizar PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        # Adicionar caminho padrao do Docker se necessario
        $dockerDefaultPath = "$env:ProgramFiles\Docker\Docker\resources\bin"
        if (Test-Path $dockerDefaultPath) {
            $env:Path = "$dockerDefaultPath;$env:Path"
        }

        # Verificar novamente
        $dockerOk = $false
        try {
            $dockerVer = docker --version 2>$null
            if ($dockerVer) {
                Write-Ok "Docker Desktop instalado: $dockerVer"
                $dockerOk = $true
            }
        } catch {}

        if (!$dockerOk) {
            Write-Warn "Docker instalado mas requer reinicializacao do computador."
            Write-Host ""
            Write-Host "  ACAO NECESSARIA:" -ForegroundColor Yellow
            Write-Host "  1. Reinicie o computador" -ForegroundColor Gray
            Write-Host "  2. Abra o Docker Desktop e aguarde iniciar" -ForegroundColor Gray
            Write-Host "  3. Execute este script novamente" -ForegroundColor Gray
            Write-Host ""
            $restart = Read-Host "  Deseja reiniciar agora? (s/n)"
            if ($restart -eq "s") {
                Restart-Computer -Force
            }
            exit 0
        }

        # Iniciar Docker Desktop se nao estiver rodando
        $dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
        if (!$dockerProcess) {
            Write-Host "  Iniciando Docker Desktop..." -ForegroundColor Gray
            Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
            Write-Host "  Aguardando Docker inicializar (pode levar 1-2 minutos)..." -ForegroundColor Gray
            $attempts = 0
            do {
                Start-Sleep -Seconds 10
                $attempts++
                try { $dockerVer = docker info 2>$null } catch { $dockerVer = $null }
            } while (!$dockerVer -and $attempts -lt 18)

            if (!$dockerVer) {
                Write-Err "Docker nao inicializou a tempo. Abra manualmente e execute o script novamente."
                exit 1
            }
            Write-Ok "Docker Desktop iniciado"
        }
    }

    # ---- Git ----
    Write-Step "Verificando Git..."
    $gitOk = $false
    try {
        $gitVer = git --version 2>$null
        if ($gitVer) {
            Write-Ok "Git encontrado: $gitVer"
            $gitOk = $true
        }
    } catch {}

    if (!$gitOk) {
        Write-Warn "Git nao encontrado. Instalando automaticamente..."

        $wingetOk = $false
        try {
            $wingetVer = winget --version 2>$null
            if ($wingetVer) { $wingetOk = $true }
        } catch {}

        if ($wingetOk) {
            winget install Git.Git --accept-source-agreements --accept-package-agreements --silent
        } else {
            Write-Host "  Baixando Git..." -ForegroundColor Gray
            $gitInstaller = "$env:TEMP\Git-Installer.exe"
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe" -OutFile $gitInstaller -UseBasicParsing
            Start-Process -FilePath $gitInstaller -ArgumentList "/VERYSILENT", "/NORESTART" -Wait -NoNewWindow
            Remove-Item $gitInstaller -Force -ErrorAction SilentlyContinue
        }

        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Ok "Git instalado"
    }

    Write-Step "Instalando Supabase Self-Hosted..."

    if (!(Test-Path "$SupabaseDir\docker")) {
        git clone --depth 1 https://github.com/supabase/supabase.git $SupabaseDir
        Write-Ok "Repositorio Supabase clonado"
    } else {
        Write-Ok "Supabase ja existe em $SupabaseDir"
    }

    Set-Location "$SupabaseDir\docker"

    if (!(Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Ok "Arquivo .env criado a partir do exemplo"
    }

    Write-Host ""
    Write-Host "  IMPORTANTE: Configure as chaves de seguranca!" -ForegroundColor Yellow
    Write-Host "  Edite o arquivo: $SupabaseDir\docker\.env" -ForegroundColor Gray
    Write-Host "  Altere: POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY" -ForegroundColor Gray
    Write-Host "  Guia: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys" -ForegroundColor Gray
    Write-Host ""

    $configDone = Read-Host "  Ja configurou o .env? (s/n)"

    if ($configDone -eq "s") {
        Write-Step "Iniciando containers do banco de dados..."
        docker compose up -d

        Write-Host "  Aguardando containers inicializarem..." -ForegroundColor Gray
        Start-Sleep -Seconds 30

        $running = docker compose ps --format "{{.State}}" 2>$null
        Write-Ok "Containers iniciados"
        Write-Host "  Painel do banco: http://localhost:$SupabasePort" -ForegroundColor White

        # Ler ANON_KEY do .env
        $envContent = Get-Content ".env" -Raw
        if ($envContent -match 'ANON_KEY=(.+)') {
            $SupabaseKey = $Matches[1].Trim()
        }
        $SupabaseUrl = "http://localhost:$SupabasePort"
        $SupabaseProjectId = "default"

        Write-Host ""
        Write-Warn "PROXIMO PASSO: Acesse http://localhost:$SupabasePort"
        Write-Host "  1. Va em SQL Editor" -ForegroundColor Gray
        Write-Host "  2. Execute o SQL do arquivo INSTALL.md (Etapa 3)" -ForegroundColor Gray
        Write-Host "  3. Crie o usuario admin em Authentication > Users" -ForegroundColor Gray
        Write-Host ""
        Read-Host "  Pressione ENTER quando terminar para continuar a instalacao"
    } else {
        Write-Warn "Configure o .env e execute o script novamente."
        exit 0
    }
}

# ----------------------------------------------------------
# 3. Pedir credenciais se necessário
# ----------------------------------------------------------
if (!$SupabaseUrl -or !$SupabaseKey) {
    Write-Step "Configurando conexao com o banco de dados..."
    Write-Host ""
    if (!$SupabaseUrl)       { $SupabaseUrl       = Read-Host "  URL do Supabase (ex: http://localhost:8000)" }
    if (!$SupabaseKey)       { $SupabaseKey       = Read-Host "  ANON_KEY do Supabase" }
    if (!$SupabaseProjectId) { $SupabaseProjectId = Read-Host "  Project ID (ex: default)" }
}

if (!$SupabaseProjectId) { $SupabaseProjectId = "default" }

# ----------------------------------------------------------
# 4. Preparar diretorio do frontend
# ----------------------------------------------------------
Write-Step "Preparando diretorio: $InstallDir"

if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($scriptDir -ne $InstallDir) {
    $excludes = @("node_modules", ".git", "dist", "C:\Supabase")
    Get-ChildItem -Path $scriptDir -Exclude $excludes | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $InstallDir -Recurse -Force
    }
    Write-Ok "Arquivos copiados"
}

Set-Location $InstallDir

# ----------------------------------------------------------
# 5. Criar .env
# ----------------------------------------------------------
Write-Step "Configurando variaveis de ambiente..."

$envContent = @"
VITE_SUPABASE_URL="$SupabaseUrl"
VITE_SUPABASE_PUBLISHABLE_KEY="$SupabaseKey"
VITE_SUPABASE_PROJECT_ID="$SupabaseProjectId"
"@

Set-Content -Path ".env" -Value $envContent -Encoding UTF8
Write-Ok "Arquivo .env criado"

# ----------------------------------------------------------
# 6. Instalar dependencias e build
# ----------------------------------------------------------
Write-Step "Instalando dependencias..."
npm install --legacy-peer-deps 2>&1 | Out-Null
Write-Ok "Dependencias instaladas"

Write-Step "Gerando build de producao..."
npm run build 2>&1 | Out-Null

if (Test-Path "dist\index.html") {
    Write-Ok "Build concluido"
} else {
    Write-Err "Build falhou. Execute 'npm run build' manualmente."
    exit 1
}

# ----------------------------------------------------------
# 7. Servidor web
# ----------------------------------------------------------
Write-Step "Instalando servidor web..."
npm install -g serve 2>&1 | Out-Null
Write-Ok "Servidor 'serve' instalado"

# ----------------------------------------------------------
# 8. Scripts de inicialização
# ----------------------------------------------------------
Write-Step "Criando scripts de inicializacao..."

# Script que inicia TUDO (banco + frontend)
$startAll = @"
@echo off
title Bravo Monitoramento
echo.
echo =============================================
echo   BRAVO MONITORAMENTO - Iniciando...
echo =============================================
echo.

echo Iniciando banco de dados...
cd /d "$SupabaseDir\docker"
docker compose up -d

echo.
echo Iniciando servidor web...
echo Acesse: http://localhost:$Port
echo Pressione Ctrl+C para parar.
echo.
cd /d "$InstallDir"
serve -s dist -l $Port
"@

$startFrontendOnly = @"
@echo off
title Bravo Monitoramento
echo Servidor rodando em: http://localhost:$Port
cd /d "$InstallDir"
serve -s dist -l $Port
"@

Set-Content -Path "$InstallDir\iniciar-bravo.bat" -Value $startAll -Encoding ASCII
Set-Content -Path "$InstallDir\iniciar-frontend.bat" -Value $startFrontendOnly -Encoding ASCII
Write-Ok "Scripts criados: iniciar-bravo.bat / iniciar-frontend.bat"

# ----------------------------------------------------------
# 9. Servico Windows (NSSM)
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

    Write-Ok "Servico Windows criado (inicia automaticamente)"
} else {
    Write-Warn "NSSM nao encontrado — instale para criar servico automatico"
    Write-Host "  Baixe: https://nssm.cc/download" -ForegroundColor Gray
    Write-Host "  Use 'iniciar-bravo.bat' para iniciar manualmente" -ForegroundColor Gray
}

# ----------------------------------------------------------
# 10. Atalho na Area de Trabalho
# ----------------------------------------------------------
Write-Step "Criando atalho..."

$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Bravo Monitoramento.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "http://localhost:$Port"
$shortcut.Description = "Abrir Bravo Monitoramento"
$shortcut.Save()

Write-Ok "Atalho criado na Area de Trabalho"

# ----------------------------------------------------------
# Resumo
# ----------------------------------------------------------
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "   INSTALACAO CONCLUIDA!" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  $InstallDir" -ForegroundColor White
if (!$SkipDatabase) {
    Write-Host "  Banco:     $SupabaseDir" -ForegroundColor White
    Write-Host "  Painel DB: http://localhost:$SupabasePort" -ForegroundColor White
}
Write-Host "  Sistema:   http://localhost:$Port" -ForegroundColor White
Write-Host "  Login:     admin@bravo.com" -ForegroundColor White
Write-Host ""
Write-Host "  Iniciar:   iniciar-bravo.bat" -ForegroundColor Gray
Write-Host "  Parar DB:  cd $SupabaseDir\docker && docker compose stop" -ForegroundColor Gray
Write-Host ""

Start-Process "http://localhost:$Port"
