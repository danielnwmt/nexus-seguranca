#Requires -RunAsAdministrator
# ============================================================
#  Bravo Monitoramento — Instalador Completo Windows
#  Instala: PostgreSQL + PostgREST + Auth Server + Frontend
#  SEM Docker! Tudo nativo.
#  Execute como Administrador:
#    powershell -ExecutionPolicy Bypass -File install-windows.ps1
# ============================================================

param(
    [string]$InstallDir = "C:\BravoMonitoramento",
    [int]$Port = 80,
    [int]$ApiPort = 8001,
    [int]$PostgRESTPort = 3000,
    [string]$PgPassword = "BravoDb2024!",
    [string]$JwtSecret = "bravo-monitoramento-jwt-secret-key-2024-super-seguro",
    [string]$AdminEmail = "admin@bravo.com",
    [string]$AdminPassword = "admin123"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [X] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "=============================================" -ForegroundColor DarkCyan
Write-Host "   BRAVO MONITORAMENTO — Instalador Windows" -ForegroundColor White
Write-Host "   PostgreSQL + PostgREST + Frontend" -ForegroundColor Gray
Write-Host "   (Sem Docker!)" -ForegroundColor Gray
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
    Write-Warn "Node.js nao encontrado. Instalando..."
    try {
        $wingetOk = $false
        try { if (winget --version 2>$null) { $wingetOk = $true } } catch {}

        if ($wingetOk) {
            winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
        } else {
            $nodeInstaller = "$env:TEMP\node-installer.msi"
            Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi" -OutFile $nodeInstaller -UseBasicParsing
            Start-Process msiexec.exe -ArgumentList "/i", $nodeInstaller, "/quiet", "/norestart" -Wait -NoNewWindow
            Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue
        }
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $nodeVersion = (node -v)
        Write-Ok "Node.js instalado: $nodeVersion"
    } catch {
        Write-Err "Falha ao instalar Node.js. Instale manualmente: https://nodejs.org"
        exit 1
    }
}

# ----------------------------------------------------------
# 2. Instalar PostgreSQL
# ----------------------------------------------------------
Write-Step "Verificando PostgreSQL..."

$pgInstallPath = "C:\Program Files\PostgreSQL\16"
$psqlPath = "$pgInstallPath\bin\psql.exe"
$pgOk = $false

if (Test-Path $psqlPath) {
    Write-Ok "PostgreSQL encontrado em $pgInstallPath"
    $pgOk = $true
} else {
    # Tentar encontrar em outras versoes
    $pgVersions = @("17", "16", "15", "14")
    foreach ($v in $pgVersions) {
        $testPath = "C:\Program Files\PostgreSQL\$v\bin\psql.exe"
        if (Test-Path $testPath) {
            $psqlPath = $testPath
            $pgInstallPath = "C:\Program Files\PostgreSQL\$v"
            Write-Ok "PostgreSQL $v encontrado"
            $pgOk = $true
            break
        }
    }
}

if (!$pgOk) {
    Write-Warn "PostgreSQL nao encontrado. Instalando automaticamente..."

    $pgInstaller = "$env:TEMP\postgresql-installer.exe"
    $pgDownloadUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64.exe"

    Write-Host "  Baixando PostgreSQL 16 (~300MB, aguarde)..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $pgDownloadUrl -OutFile $pgInstaller -UseBasicParsing

    Write-Host "  Instalando PostgreSQL (modo silencioso)..." -ForegroundColor Gray
    $pgArgs = @(
        "--mode", "unattended",
        "--unattendedmodeui", "none",
        "--superpassword", $PgPassword,
        "--serverport", "5432",
        "--prefix", $pgInstallPath,
        "--datadir", "$pgInstallPath\data",
        "--install_runtimes", "0"
    )
    Start-Process -FilePath $pgInstaller -ArgumentList $pgArgs -Wait -NoNewWindow
    Remove-Item $pgInstaller -Force -ErrorAction SilentlyContinue

    # Atualizar PATH
    $env:Path = "$pgInstallPath\bin;$env:Path"
    [System.Environment]::SetEnvironmentVariable("Path", "$pgInstallPath\bin;" + [System.Environment]::GetEnvironmentVariable("Path","Machine"), "Machine")

    if (Test-Path $psqlPath) {
        Write-Ok "PostgreSQL instalado com sucesso"
        $pgOk = $true
    } else {
        Write-Err "Falha ao instalar PostgreSQL"
        exit 1
    }
}

# Garantir que PostgreSQL esta no PATH
if (!(Get-Command psql -ErrorAction SilentlyContinue)) {
    $pgBin = Split-Path $psqlPath
    $env:Path = "$pgBin;$env:Path"
}

# Garantir que servico PostgreSQL esta rodando
Write-Host "  Verificando servico PostgreSQL..." -ForegroundColor Gray
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgService) {
    if ($pgService.Status -ne 'Running') {
        Start-Service $pgService.Name
        Start-Sleep -Seconds 3
    }
    Write-Ok "Servico PostgreSQL rodando: $($pgService.Name)"
} else {
    Write-Warn "Servico PostgreSQL nao encontrado. Inicie manualmente."
}

# ----------------------------------------------------------
# 3. Criar banco de dados e tabelas
# ----------------------------------------------------------
Write-Step "Configurando banco de dados..."

$env:PGPASSWORD = $PgPassword

# Criar banco
$dbExists = & $psqlPath -h localhost -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='bravo'" 2>$null
if ($dbExists -match "1") {
    Write-Ok "Banco 'bravo' ja existe"
} else {
    & $psqlPath -h localhost -U postgres -c "CREATE DATABASE bravo;" 2>$null
    Write-Ok "Banco 'bravo' criado"
}

# Executar script de inicializacao
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "installer\init-database.sql"
if (!(Test-Path $sqlFile)) {
    $sqlFile = Join-Path $InstallDir "installer\init-database.sql"
}

if (Test-Path $sqlFile) {
    Write-Host "  Executando script de inicializacao..." -ForegroundColor Gray
    & $psqlPath -h localhost -U postgres -d bravo -f $sqlFile 2>&1 | Out-Null
    Write-Ok "Tabelas e funcoes criadas"
} else {
    Write-Err "Arquivo init-database.sql nao encontrado em: $sqlFile"
    exit 1
}

# Criar usuario admin
Write-Host "  Criando usuario admin..." -ForegroundColor Gray
$createAdmin = @"
INSERT INTO auth.users (email, encrypted_password)
VALUES ('$AdminEmail', crypt('$AdminPassword', gen_salt('bf')))
ON CONFLICT (email) DO NOTHING;
"@
& $psqlPath -h localhost -U postgres -d bravo -c $createAdmin 2>&1 | Out-Null
Write-Ok "Usuario admin criado: $AdminEmail"

# ----------------------------------------------------------
# 4. Instalar PostgREST
# ----------------------------------------------------------
Write-Step "Instalando PostgREST..."

$postgrestDir = "$InstallDir\postgrest"
$postgrestExe = "$postgrestDir\postgrest.exe"

if (Test-Path $postgrestExe) {
    Write-Ok "PostgREST ja instalado"
} else {
    New-Item -ItemType Directory -Path $postgrestDir -Force | Out-Null

    $postgrestUrl = "https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-windows-x64.zip"
    $postgrestZip = "$env:TEMP\postgrest.zip"

    Write-Host "  Baixando PostgREST..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $postgrestUrl -OutFile $postgrestZip -UseBasicParsing

    Expand-Archive -Path $postgrestZip -DestinationPath $postgrestDir -Force
    Remove-Item $postgrestZip -Force -ErrorAction SilentlyContinue

    if (Test-Path $postgrestExe) {
        Write-Ok "PostgREST instalado"
    } else {
        # O exe pode estar em subpasta
        $found = Get-ChildItem -Path $postgrestDir -Recurse -Filter "postgrest.exe" | Select-Object -First 1
        if ($found) {
            Move-Item $found.FullName $postgrestExe -Force
            Write-Ok "PostgREST instalado"
        } else {
            Write-Err "Falha ao instalar PostgREST"
            exit 1
        }
    }
}

# Criar config do PostgREST
$postgrestConf = @"
db-uri = "postgres://authenticator:bravo_auth_2024@localhost:5432/bravo"
db-schemas = "public"
db-anon-role = "anon"
db-pool = 10
server-host = "127.0.0.1"
server-port = $PostgRESTPort
jwt-secret = "$JwtSecret"
"@
Set-Content -Path "$postgrestDir\postgrest.conf" -Value $postgrestConf -Encoding UTF8
Write-Ok "Configuracao PostgREST criada"

# Definir senha do role authenticator
& $psqlPath -h localhost -U postgres -d bravo -c "ALTER ROLE authenticator WITH PASSWORD 'bravo_auth_2024';" 2>&1 | Out-Null

# ----------------------------------------------------------
# 5. Configurar Auth Server (Node.js)
# ----------------------------------------------------------
Write-Step "Configurando Auth Server..."

$authServerDir = "$InstallDir\auth-server"
New-Item -ItemType Directory -Path $authServerDir -Force | Out-Null

# Copiar auth-server.js
$authSrc = Join-Path $scriptDir "installer\auth-server.js"
if (!(Test-Path $authSrc)) {
    $authSrc = Join-Path $InstallDir "installer\auth-server.js"
}

if (Test-Path $authSrc) {
    Copy-Item $authSrc "$authServerDir\server.js" -Force
} else {
    Write-Err "auth-server.js nao encontrado"
    exit 1
}

# Atualizar config no auth-server
$serverContent = Get-Content "$authServerDir\server.js" -Raw
$serverContent = $serverContent -replace "const PORT = \d+;", "const PORT = $ApiPort;"
$serverContent = $serverContent -replace "const JWT_SECRET = '[^']+';", "const JWT_SECRET = '$JwtSecret';"
$serverContent = $serverContent -replace "const POSTGREST_URL = '[^']+';", "const POSTGREST_URL = 'http://127.0.0.1:$PostgRESTPort';"
$serverContent = $serverContent -replace "password: ''", "password: '$PgPassword'"
Set-Content -Path "$authServerDir\server.js" -Value $serverContent -Encoding UTF8

# Instalar pg (driver PostgreSQL para Node.js)
Set-Location $authServerDir
npm init -y 2>&1 | Out-Null
npm install pg 2>&1 | Out-Null
Write-Ok "Auth Server configurado"

# ----------------------------------------------------------
# 6. Preparar frontend
# ----------------------------------------------------------
Write-Step "Preparando frontend: $InstallDir"

if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

if ($scriptDir -ne $InstallDir) {
    $excludes = @("node_modules", ".git", "dist", "postgrest", "auth-server")
    Get-ChildItem -Path $scriptDir -Exclude $excludes | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $InstallDir -Recurse -Force
    }
    Write-Ok "Arquivos copiados"
}

Set-Location $InstallDir

# ----------------------------------------------------------
# 7. Criar .env do frontend
# ----------------------------------------------------------
Write-Step "Configurando variaveis de ambiente..."

$envContent = @"
VITE_SUPABASE_URL="http://localhost:$ApiPort"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMH0.local"
VITE_SUPABASE_PROJECT_ID="local"
VITE_API_URL="http://localhost:$ApiPort"
"@

Set-Content -Path ".env" -Value $envContent -Encoding UTF8
Write-Ok "Arquivo .env criado"

# ----------------------------------------------------------
# 8. Build do frontend
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
# 9. Instalar servidor web
# ----------------------------------------------------------
Write-Step "Instalando servidor web..."
npm install -g serve 2>&1 | Out-Null
Write-Ok "Servidor 'serve' instalado"

# ----------------------------------------------------------
# 10. Scripts de inicializacao
# ----------------------------------------------------------
Write-Step "Criando scripts de inicializacao..."

$startAll = @"
@echo off
title Bravo Monitoramento
echo.
echo =============================================
echo   BRAVO MONITORAMENTO - Iniciando...
echo =============================================
echo.

echo [1/3] Verificando PostgreSQL...
net start postgresql-x64-16 2>nul
timeout /t 2 /nobreak >nul

echo [2/3] Iniciando PostgREST (API REST)...
start /min "PostgREST" "$postgrestExe" "$postgrestDir\postgrest.conf"
timeout /t 2 /nobreak >nul

echo [3/3] Iniciando Auth Server...
start /min "AuthServer" node "$authServerDir\server.js"
timeout /t 2 /nobreak >nul

echo.
echo Iniciando servidor web...
echo Acesse: http://localhost:$Port
echo Pressione Ctrl+C para parar.
echo.
cd /d "$InstallDir"
serve -s dist -l $Port
"@

$stopAll = @"
@echo off
echo Parando Bravo Monitoramento...
taskkill /f /im postgrest.exe 2>nul
taskkill /f /fi "WINDOWTITLE eq AuthServer*" 2>nul
echo Servidor parado.
pause
"@

Set-Content -Path "$InstallDir\iniciar-bravo.bat" -Value $startAll -Encoding ASCII
Set-Content -Path "$InstallDir\parar-bravo.bat" -Value $stopAll -Encoding ASCII
Write-Ok "Scripts criados: iniciar-bravo.bat / parar-bravo.bat"

# ----------------------------------------------------------
# 11. Script de atualizacao
# ----------------------------------------------------------
Write-Step "Criando script de atualizacao..."

$updateScript = @"
@echo off
title Bravo Monitoramento - Atualizacao
echo.
echo =============================================
echo   BRAVO MONITORAMENTO - Atualizacao
echo =============================================
echo.
echo Parando servicos...
taskkill /f /im postgrest.exe 2>nul
taskkill /f /fi "WINDOWTITLE eq AuthServer*" 2>nul

cd /d "$InstallDir"

echo.
echo Baixando atualizacao do GitHub...
git pull origin main

echo.
echo Reinstalando dependencias...
call npm install --legacy-peer-deps

echo.
echo Gerando novo build...
call npm run build

echo.
echo =============================================
echo   ATUALIZACAO CONCLUIDA!
echo   Execute iniciar-bravo.bat para iniciar.
echo =============================================
pause
"@

Set-Content -Path "$InstallDir\atualizar-bravo.bat" -Value $updateScript -Encoding ASCII
Write-Ok "Script de atualizacao criado: atualizar-bravo.bat"

# ----------------------------------------------------------
# 12. Servico Windows (NSSM)
# ----------------------------------------------------------
Write-Step "Configurando servico Windows..."

$nssmPath = $null
try { $nssmPath = (Get-Command nssm -ErrorAction SilentlyContinue).Source } catch {}

if ($nssmPath) {
    # PostgREST como servico
    nssm stop BravoPostgREST 2>$null
    nssm remove BravoPostgREST confirm 2>$null
    nssm install BravoPostgREST $postgrestExe "$postgrestDir\postgrest.conf"
    nssm set BravoPostgREST DisplayName "Bravo - PostgREST"
    nssm set BravoPostgREST Start SERVICE_AUTO_START
    nssm start BravoPostgREST

    # Auth Server como servico
    $nodePath = (Get-Command node).Source
    nssm stop BravoAuthServer 2>$null
    nssm remove BravoAuthServer confirm 2>$null
    nssm install BravoAuthServer $nodePath "$authServerDir\server.js"
    nssm set BravoAuthServer AppDirectory $authServerDir
    nssm set BravoAuthServer DisplayName "Bravo - Auth Server"
    nssm set BravoAuthServer Start SERVICE_AUTO_START
    nssm start BravoAuthServer

    # Frontend como servico
    $servePath = (Get-Command serve).Source
    nssm stop BravoFrontend 2>$null
    nssm remove BravoFrontend confirm 2>$null
    nssm install BravoFrontend $servePath "-s dist -l $Port"
    nssm set BravoFrontend AppDirectory $InstallDir
    nssm set BravoFrontend DisplayName "Bravo - Frontend"
    nssm set BravoFrontend Start SERVICE_AUTO_START
    nssm start BravoFrontend

    Write-Ok "3 servicos Windows criados (inicio automatico)"
} else {
    Write-Warn "NSSM nao encontrado — use 'iniciar-bravo.bat' para iniciar manualmente"
    Write-Host "  Para servico automatico, instale NSSM: https://nssm.cc/download" -ForegroundColor Gray
}

# ----------------------------------------------------------
# 13. Atalho na Area de Trabalho
# ----------------------------------------------------------
Write-Step "Criando atalhos..."

$desktopPath = [Environment]::GetFolderPath("Desktop")

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut("$desktopPath\Bravo Monitoramento.lnk")
$shortcut.TargetPath = "http://localhost:$Port"
$shortcut.Description = "Abrir Bravo Monitoramento"
$shortcut.Save()

$shortcut2 = $shell.CreateShortcut("$desktopPath\Iniciar Bravo.lnk")
$shortcut2.TargetPath = "$InstallDir\iniciar-bravo.bat"
$shortcut2.WorkingDirectory = $InstallDir
$shortcut2.Description = "Iniciar todos os servicos do Bravo"
$shortcut2.Save()

Write-Ok "Atalhos criados na Area de Trabalho"

# ----------------------------------------------------------
# Resumo
# ----------------------------------------------------------
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "   INSTALACAO CONCLUIDA!" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  COMPONENTES INSTALADOS:" -ForegroundColor Cyan
Write-Host "  - PostgreSQL........: localhost:5432" -ForegroundColor White
Write-Host "  - PostgREST (API)...: localhost:$PostgRESTPort" -ForegroundColor White
Write-Host "  - Auth Server.......: localhost:$ApiPort" -ForegroundColor White
Write-Host "  - Frontend..........: localhost:$Port" -ForegroundColor White
Write-Host ""
Write-Host "  ACESSO:" -ForegroundColor Cyan
Write-Host "  URL:    http://localhost:$Port" -ForegroundColor White
Write-Host "  Email:  $AdminEmail" -ForegroundColor White
Write-Host "  Senha:  $AdminPassword" -ForegroundColor White
Write-Host ""
Write-Host "  SCRIPTS:" -ForegroundColor Cyan
Write-Host "  Iniciar:    iniciar-bravo.bat" -ForegroundColor Gray
Write-Host "  Parar:      parar-bravo.bat" -ForegroundColor Gray
Write-Host "  Atualizar:  atualizar-bravo.bat" -ForegroundColor Gray
Write-Host ""
Write-Host "  ATUALIZACOES:" -ForegroundColor Cyan
Write-Host "  1. Conecte ao GitHub: git remote add origin <URL>" -ForegroundColor Gray
Write-Host "  2. Execute: atualizar-bravo.bat" -ForegroundColor Gray
Write-Host ""

Start-Process "http://localhost:$Port"
