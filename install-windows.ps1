#Requires -RunAsAdministrator
# ============================================================
#  Nexus Monitoramento - Instalador Completo Windows
#  Instala: PostgreSQL + PostgREST + Auth Server + Frontend
#  SEM Docker! Tudo nativo.
#  Execute como Administrador:
#    powershell -ExecutionPolicy Bypass -File install-windows.ps1
# ============================================================

param(
    [string]$InstallDir = "C:\NexusMonitoramento",
    [int]$Port = 80,
    [int]$ApiPort = 8001,
    [int]$PostgRESTPort = 3000,
    [string]$PgPassword = "NexusDb2024!",
    [string]$JwtSecret = "nexus-monitoramento-jwt-secret-key-2024-super-seguro",
    [string]$AdminEmail = "admin@protenexus.com",
    [string]$AdminPassword = "1234"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [X] $msg" -ForegroundColor Red }

function Get-PostgresDataDir([string]$pgInstallPath) {
    $candidate = Join-Path $pgInstallPath "data"
    if (Test-Path (Join-Path $candidate "pg_hba.conf")) { return $candidate }

    try {
        $pgSvc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($pgSvc) {
            $svc = Get-CimInstance Win32_Service -Filter "Name='$($pgSvc.Name)'"
            if ($svc -and $svc.PathName -match '-D\s+"?([^"]+)"?') {
                $svcDataDir = $Matches[1].Trim()
                if (Test-Path (Join-Path $svcDataDir "pg_hba.conf")) { return $svcDataDir }
            }
        }
    } catch {}

    return $null
}

function Set-PostgresPasswordWithTrust([string]$psqlPath, [string]$pgInstallPath, [string]$PgPassword) {
    $pgDataDir = Get-PostgresDataDir -pgInstallPath $pgInstallPath
    if (-not $pgDataDir) {
        Write-Warn "Nao foi possivel localizar pg_hba.conf para redefinir senha"
        return $false
    }

    $pgHbaPath = Join-Path $pgDataDir "pg_hba.conf"
    $pgHbaBackup = "$pgHbaPath.bak-nexus"
    $pgSvc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
    $alterOk = $false

    try {
        Copy-Item $pgHbaPath $pgHbaBackup -Force
        $hbaContent = Get-Content -Path $pgHbaPath -Raw
        $trustBlock = @"
# nexus-temp-trust-start
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
# nexus-temp-trust-end
"@
        Set-Content -Path $pgHbaPath -Value ($trustBlock + "`r`n" + $hbaContent) -Encoding UTF8

        if ($pgSvc) { Restart-Service $pgSvc.Name -Force; Start-Sleep -Seconds 3 }

        & $psqlPath -h localhost -U postgres -d postgres -c "ALTER USER postgres PASSWORD '$PgPassword';" 2>&1 | Out-Null
        $alterOk = ($LASTEXITCODE -eq 0)
    } catch {
        Write-Warn "Falha ao redefinir senha do PostgreSQL: $($_.Exception.Message)"
    } finally {
        if (Test-Path $pgHbaBackup) {
            Copy-Item $pgHbaBackup $pgHbaPath -Force
            Remove-Item $pgHbaBackup -Force -ErrorAction SilentlyContinue
        }
        if ($pgSvc) { Restart-Service $pgSvc.Name -Force; Start-Sleep -Seconds 3 }
    }

    if ($alterOk) {
        Write-Ok "Senha do PostgreSQL configurada"
        return $true
    }

    return $false
}

function Test-PostgresAccess([string]$psqlPath, [string]$PgPassword) {
    $env:PGPASSWORD = $PgPassword
    & $psqlPath -h localhost -U postgres -d postgres -tAc "SELECT 1;" 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor DarkCyan
Write-Host "   NEXUS MONITORAMENTO - Instalador Windows" -ForegroundColor White
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

    $installedByWinget = $false
    $wingetOk = $false
    try { if (winget --version 2>$null) { $wingetOk = $true } } catch {}

    if ($wingetOk) {
        Write-Host "  Tentando instalar PostgreSQL 16 via winget..." -ForegroundColor Gray
        try {
            $wg = Start-Process -FilePath "winget" -ArgumentList @(
                "install",
                "--id", "PostgreSQL.PostgreSQL.16",
                "-e",
                "--accept-source-agreements",
                "--accept-package-agreements",
                "--silent"
            ) -Wait -NoNewWindow -PassThru

            if ($wg.ExitCode -eq 0) {
                $installedByWinget = $true
                Write-Ok "PostgreSQL instalado via winget"
            } else {
                Write-Warn "Winget retornou codigo $($wg.ExitCode). Tentando instalador oficial..."
            }
        } catch {
            Write-Warn "Falha no winget: $($_.Exception.Message)"
        }
    }

    if (-not $installedByWinget) {
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

        $pgProc = Start-Process -FilePath $pgInstaller -ArgumentList $pgArgs -Wait -NoNewWindow -PassThru
        Remove-Item $pgInstaller -Force -ErrorAction SilentlyContinue

        if ($pgProc.ExitCode -ne 0) {
            Write-Warn "Instalador oficial retornou codigo $($pgProc.ExitCode)"
        }
    }

    Start-Sleep -Seconds 3

    # Redetectar psql em versoes comuns
    $pgVersionsAfterInstall = @("17", "16", "15", "14")
    foreach ($v in $pgVersionsAfterInstall) {
        $testPath = "C:\Program Files\PostgreSQL\$v\bin\psql.exe"
        if (Test-Path $testPath) {
            $psqlPath = $testPath
            $pgInstallPath = "C:\Program Files\PostgreSQL\$v"
            $pgOk = $true
            break
        }
    }

    if ($pgOk) {
        # Atualizar PATH
        $pgBinPath = "$pgInstallPath\bin"
        $env:Path = "$pgBinPath;$env:Path"
        $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
        if ($machinePath -notlike "*$pgBinPath*") {
            [System.Environment]::SetEnvironmentVariable("Path", "$pgBinPath;$machinePath", "Machine")
        }

        if ($installedByWinget) {
            Write-Host "  Configurando senha do PostgreSQL (instalado via winget)..." -ForegroundColor Gray
            Start-Sleep -Seconds 5
            [void](Set-PostgresPasswordWithTrust -psqlPath $psqlPath -pgInstallPath $pgInstallPath -PgPassword $PgPassword)
        }

        Write-Ok "PostgreSQL instalado com sucesso"
    } else {
        Write-Err "Falha ao instalar PostgreSQL automaticamente"
        Write-Host "  Instale manualmente: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads" -ForegroundColor Gray
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

if (-not (Test-PostgresAccess -psqlPath $psqlPath -PgPassword $PgPassword)) {
    Write-Warn "Falha de autenticacao no PostgreSQL com a senha configurada. Tentando corrigir automaticamente..."
    $fixed = Set-PostgresPasswordWithTrust -psqlPath $psqlPath -pgInstallPath $pgInstallPath -PgPassword $PgPassword
    if (-not $fixed -or -not (Test-PostgresAccess -psqlPath $psqlPath -PgPassword $PgPassword)) {
        Write-Err "Nao foi possivel autenticar no PostgreSQL com a senha configurada"
        Write-Host "  Verifique o usuario postgres e tente novamente" -ForegroundColor Gray
        exit 1
    }
}

# Criar banco
try {
    $dbExists = & $psqlPath -h localhost -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='nexus'" 2>&1
} catch { $dbExists = "" }
if ("$dbExists" -match "1") {
    Write-Ok "Banco 'nexus' ja existe"
} else {
    & $psqlPath -h localhost -U postgres -c "CREATE DATABASE nexus;" 2>&1 | Out-Null
    Write-Ok "Banco 'nexus' criado"
}

# Executar script de inicializacao
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "installer\init-database.sql"
if (!(Test-Path $sqlFile)) {
    $sqlFile = Join-Path $InstallDir "installer\init-database.sql"
}

if (Test-Path $sqlFile) {
    Write-Host "  Executando script de inicializacao..." -ForegroundColor Gray
    & $psqlPath -h localhost -U postgres -d nexus -f $sqlFile 2>&1 | Out-Null
    Write-Ok "Tabelas e funcoes criadas"
} else {
    Write-Err "Arquivo init-database.sql nao encontrado em: $sqlFile"
    exit 1
}

# Criar usuario admin
Write-Host "  Criando usuario admin..." -ForegroundColor Gray
$createAdmin = "INSERT INTO auth.users (email, encrypted_password) VALUES ('" + $AdminEmail + "', crypt('" + $AdminPassword + "', gen_salt('bf'))) ON CONFLICT (email) DO NOTHING;"
try {
    & $psqlPath -h localhost -U postgres -d nexus -c $createAdmin 2>&1 | Out-Null
    Write-Ok "Usuario admin criado: $AdminEmail"
} catch {
    Write-Warn "Nao foi possivel criar usuario admin (pode ja existir)"
}

# ----------------------------------------------------------
# 3.1 Criar pasta de gravacoes e servidor padrao
# ----------------------------------------------------------
Write-Step "Configurando armazenamento local..."

$storagePath = "$InstallDir\Gravacoes"
if (!(Test-Path $storagePath)) {
    New-Item -ItemType Directory -Path $storagePath -Force | Out-Null
}
Write-Ok "Pasta de gravacoes criada: $storagePath"

# Obter IP local
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress
if (!$localIP) { $localIP = "127.0.0.1" }

# Registrar servidor padrao no banco
$escapedPath = $storagePath -replace "\\", "\\"
$freeGB = 500
try {
    $driveLetter = $storagePath.Substring(0,1)
    $driveInfo = Get-PSDrive -Name $driveLetter -ErrorAction SilentlyContinue
    if ($driveInfo) { $freeGB = [math]::Round($driveInfo.Free / 1GB) }
} catch {}
$createServer = "INSERT INTO public.storage_servers (name, ip_address, storage_path, max_storage_gb, status, description) VALUES ('Servidor Local', '" + $localIP + "', '" + $escapedPath + "', " + $freeGB + ", 'active', 'Servidor de gravacao local - configurado automaticamente') ON CONFLICT DO NOTHING;"
try {
    & $psqlPath -h localhost -U postgres -d nexus -c $createServer 2>&1 | Out-Null
    Write-Ok "Servidor de gravacao registrado no banco (IP: $localIP)"
} catch {
    Write-Warn "Nao foi possivel registrar servidor automaticamente"
}

# Criar subpastas de exemplo
New-Item -ItemType Directory -Path "$storagePath\_modelo\CAM01" -Force | Out-Null
Write-Ok "Estrutura de pastas criada"

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
db-uri = "postgres://authenticator:nexus_auth_2024@localhost:5432/nexus"
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
& $psqlPath -h localhost -U postgres -d nexus -c "ALTER ROLE authenticator WITH PASSWORD 'nexus_auth_2024';" 2>&1 | Out-Null

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
# 9.1 Instalar MediaMTX (Servidor de Midia RTMP/RTSP/HLS)
# ----------------------------------------------------------
Write-Step "Instalando MediaMTX (servidor de midia)..."

$mediamtxDir = "$InstallDir\mediamtx"
$mediamtxExe = "$mediamtxDir\mediamtx.exe"

if (Test-Path $mediamtxExe) {
    Write-Ok "MediaMTX ja instalado"
} else {
    New-Item -ItemType Directory -Path $mediamtxDir -Force | Out-Null

    $mediamtxUrl = "https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_windows_amd64.zip"
    $mediamtxZip = "$env:TEMP\mediamtx.zip"

    Write-Host "  Baixando MediaMTX..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $mediamtxUrl -OutFile $mediamtxZip -UseBasicParsing

    Expand-Archive -Path $mediamtxZip -DestinationPath $mediamtxDir -Force
    Remove-Item $mediamtxZip -Force -ErrorAction SilentlyContinue

    if (Test-Path $mediamtxExe) {
        Write-Ok "MediaMTX instalado"
    } else {
        $found = Get-ChildItem -Path $mediamtxDir -Recurse -Filter "mediamtx.exe" | Select-Object -First 1
        if ($found) {
            Move-Item $found.FullName $mediamtxExe -Force
            Write-Ok "MediaMTX instalado"
        } else {
            Write-Warn "MediaMTX nao encontrado. Instale manualmente: https://github.com/bluenviron/mediamtx"
        }
    }
}

# Copiar config do MediaMTX
$mediamtxCfgSrc = Join-Path $scriptDir "installer\mediamtx.yml"
if (Test-Path $mediamtxCfgSrc) {
    Copy-Item $mediamtxCfgSrc "$mediamtxDir\mediamtx.yml" -Force
    Write-Ok "Configuracao MediaMTX copiada"
}

# ----------------------------------------------------------
# 9.2 Instalar ffmpeg (para captura de frames IA)
# ----------------------------------------------------------
Write-Step "Instalando ffmpeg (analise de video IA)..."

$ffmpegPath = $null
try { $ffmpegPath = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source } catch {}

if ($ffmpegPath) {
    Write-Ok "ffmpeg ja instalado: $ffmpegPath"
} else {
    $ffmpegDir = "$InstallDir\ffmpeg"
    New-Item -ItemType Directory -Path $ffmpegDir -Force | Out-Null
    $ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    $ffmpegZip = "$env:TEMP\ffmpeg.zip"
    Write-Host "  Baixando ffmpeg..." -ForegroundColor Gray
    try {
        Invoke-WebRequest -Uri $ffmpegUrl -OutFile $ffmpegZip -UseBasicParsing
        Expand-Archive -Path $ffmpegZip -DestinationPath "$env:TEMP\ffmpeg-extract" -Force
        $ffBin = Get-ChildItem -Path "$env:TEMP\ffmpeg-extract" -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
        if ($ffBin) {
            Copy-Item $ffBin.FullName "$ffmpegDir\ffmpeg.exe" -Force
            # Adicionar ao PATH do sistema
            $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
            if ($currentPath -notlike "*$ffmpegDir*") {
                [Environment]::SetEnvironmentVariable("Path", "$currentPath;$ffmpegDir", "Machine")
                $env:Path = "$env:Path;$ffmpegDir"
            }
            Write-Ok "ffmpeg instalado em $ffmpegDir"
        } else {
            Write-Warn "ffmpeg nao encontrado no pacote"
        }
        Remove-Item $ffmpegZip -Force -ErrorAction SilentlyContinue
        Remove-Item "$env:TEMP\ffmpeg-extract" -Recurse -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Warn "Falha ao baixar ffmpeg: $($_.Exception.Message)"
        Write-Host "  Instale manualmente: https://ffmpeg.org/download.html" -ForegroundColor Gray
    }
}

# ----------------------------------------------------------
# 9.3 Configurar servico de Analytics IA
# ----------------------------------------------------------
Write-Step "Configurando servico de Analytics IA..."

$analyticsDir = "$InstallDir\analytics"
New-Item -ItemType Directory -Path $analyticsDir -Force | Out-Null

$analyticsSrc = Join-Path $scriptDir "installer\analytics-service.js"
if (Test-Path $analyticsSrc) {
    Copy-Item $analyticsSrc "$analyticsDir\analytics-service.js" -Force
    Write-Ok "Servico de Analytics copiado"
}

# Criar arquivo .env para o servico de analytics
$analyticsEnv = @"
SUPABASE_URL=$env:VITE_SUPABASE_URL
SUPABASE_KEY=$env:VITE_SUPABASE_PUBLISHABLE_KEY
PG_HOST=localhost
PG_PORT=5432
PG_DB=nexus
PG_USER=postgres
PG_PASS=$PgPassword
MEDIAMTX_API=http://127.0.0.1:9997
MEDIAMTX_HLS=http://127.0.0.1:8888
TEMP_DIR=$analyticsDir\snapshots
ANALYZE_INTERVAL=15
"@
Set-Content -Path "$analyticsDir\.env" -Value $analyticsEnv -Encoding UTF8
Write-Ok "Configuracao do Analytics IA criada"

# ----------------------------------------------------------
# 10. Scripts de inicializacao
# ----------------------------------------------------------
Write-Step "Criando scripts de inicializacao..."

$startAll = @"
@echo off
title Nexus Monitoramento
echo.
echo =============================================
echo   NEXUS MONITORAMENTO - Iniciando...
echo =============================================
echo.

echo [1/5] Verificando PostgreSQL...
net start postgresql-x64-16 2>nul
timeout /t 2 /nobreak >nul

echo [2/5] Iniciando PostgREST (API REST)...
start /min "PostgREST" "$postgrestExe" "$postgrestDir\postgrest.conf"
timeout /t 2 /nobreak >nul

echo [3/5] Iniciando Auth Server...
start /min "AuthServer" node "$authServerDir\server.js"
timeout /t 2 /nobreak >nul

echo [4/5] Iniciando MediaMTX (Servidor de Midia)...
start /min "MediaMTX" "$mediamtxExe" "$mediamtxDir\mediamtx.yml"
timeout /t 2 /nobreak >nul

echo [5/5] Iniciando Analytics IA...
start /min "AnalyticsIA" node "$analyticsDir\analytics-service.js"
timeout /t 2 /nobreak >nul

echo.
echo Iniciando servidor web...
echo Acesse: http://localhost:$Port
echo.
echo ============ SERVIDOR DE MIDIA ============
echo RTMP: rtmp://localhost:1935/{nome_camera}
echo RTSP: rtsp://localhost:8554/{nome_camera}
echo HLS:  http://localhost:8888/{nome_camera}/
echo ============ ANALYTICS IA =================
echo Analise de video em tempo real ATIVA
echo ============================================
echo.
echo Pressione Ctrl+C para parar.
echo.
cd /d "$InstallDir"
serve -s dist -l $Port
"@

$stopAll = @"
@echo off
echo Parando Nexus Monitoramento...
taskkill /f /im postgrest.exe 2>nul
taskkill /f /im mediamtx.exe 2>nul
taskkill /f /fi "WINDOWTITLE eq AuthServer*" 2>nul
taskkill /f /fi "WINDOWTITLE eq AnalyticsIA*" 2>nul
echo Servidor parado.
pause
"@

Set-Content -Path "$InstallDir\iniciar-nexus.bat" -Value $startAll -Encoding ASCII
Set-Content -Path "$InstallDir\parar-nexus.bat" -Value $stopAll -Encoding ASCII
Write-Ok "Scripts criados: iniciar-nexus.bat / parar-nexus.bat"

# ----------------------------------------------------------
# 11. Script de atualizacao
# ----------------------------------------------------------
Write-Step "Criando script de atualizacao..."

$updateScript = @"
@echo off
title Nexus Monitoramento - Atualizacao
echo.
echo =============================================
echo   NEXUS MONITORAMENTO - Atualizacao
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
echo   Execute iniciar-nexus.bat para iniciar.
echo =============================================
pause
"@

Set-Content -Path "$InstallDir\atualizar-nexus.bat" -Value $updateScript -Encoding ASCII
Write-Ok "Script de atualizacao criado: atualizar-nexus.bat"

# ----------------------------------------------------------
# 12. Servico Windows (NSSM)
# ----------------------------------------------------------
Write-Step "Configurando servico Windows..."

$nssmPath = $null
try { $nssmPath = (Get-Command nssm -ErrorAction SilentlyContinue).Source } catch {}

if ($nssmPath) {
    # PostgREST como servico
    nssm stop NexusPostgREST 2>$null
    nssm remove NexusPostgREST confirm 2>$null
    nssm install NexusPostgREST $postgrestExe "$postgrestDir\postgrest.conf"
    nssm set NexusPostgREST DisplayName "Nexus - PostgREST"
    nssm set NexusPostgREST Start SERVICE_AUTO_START
    nssm start NexusPostgREST

    # Auth Server como servico
    $nodePath = (Get-Command node).Source
    nssm stop NexusAuthServer 2>$null
    nssm remove NexusAuthServer confirm 2>$null
    nssm install NexusAuthServer $nodePath "$authServerDir\server.js"
    nssm set NexusAuthServer AppDirectory $authServerDir
    nssm set NexusAuthServer DisplayName "Nexus - Auth Server"
    nssm set NexusAuthServer Start SERVICE_AUTO_START
    nssm start NexusAuthServer

    # MediaMTX como servico
    nssm stop NexusMediaMTX 2>$null
    nssm remove NexusMediaMTX confirm 2>$null
    nssm install NexusMediaMTX $mediamtxExe "$mediamtxDir\mediamtx.yml"
    nssm set NexusMediaMTX AppDirectory $mediamtxDir
    nssm set NexusMediaMTX DisplayName "Nexus - MediaMTX (Servidor de Midia)"
    nssm set NexusMediaMTX Start SERVICE_AUTO_START
    nssm start NexusMediaMTX

    # Analytics IA como servico
    nssm stop NexusAnalytics 2>$null
    nssm remove NexusAnalytics confirm 2>$null
    nssm install NexusAnalytics $nodePath "$analyticsDir\analytics-service.js"
    nssm set NexusAnalytics AppDirectory $analyticsDir
    nssm set NexusAnalytics DisplayName "Nexus - Analytics IA"
    nssm set NexusAnalytics AppEnvironmentExtra "SUPABASE_URL=$env:VITE_SUPABASE_URL" "SUPABASE_KEY=$env:VITE_SUPABASE_PUBLISHABLE_KEY" "PG_PASS=$PgPassword"
    nssm set NexusAnalytics Start SERVICE_AUTO_START
    nssm start NexusAnalytics

    # Frontend como servico
    $servePath = (Get-Command serve).Source
    nssm stop NexusFrontend 2>$null
    nssm remove NexusFrontend confirm 2>$null
    nssm install NexusFrontend $servePath "-s dist -l $Port"
    nssm set NexusFrontend AppDirectory $InstallDir
    nssm set NexusFrontend DisplayName "Nexus - Frontend"
    nssm set NexusFrontend Start SERVICE_AUTO_START
    nssm start NexusFrontend

    Write-Ok "5 servicos Windows criados (inicio automatico)"
} else {
    Write-Warn "NSSM nao encontrado - use 'iniciar-nexus.bat' para iniciar manualmente"
    Write-Host "  Para servico automatico, instale NSSM: https://nssm.cc/download" -ForegroundColor Gray
}

# ----------------------------------------------------------
# 13. Atalho na Area de Trabalho
# ----------------------------------------------------------
Write-Step "Criando atalhos..."

$desktopPath = [Environment]::GetFolderPath("Desktop")

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut("$desktopPath\Nexus Monitoramento.lnk")
$shortcut.TargetPath = "http://localhost:$Port"
$shortcut.Description = "Abrir Nexus Monitoramento"
$shortcut.Save()

$shortcut2 = $shell.CreateShortcut("$desktopPath\Iniciar Nexus.lnk")
$shortcut2.TargetPath = "$InstallDir\iniciar-nexus.bat"
$shortcut2.WorkingDirectory = $InstallDir
$shortcut2.Description = "Iniciar todos os servicos do Nexus"
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
Write-Host "  - MediaMTX (Midia)..: RTMP :1935 | RTSP :8554 | HLS :8888" -ForegroundColor White
Write-Host "  - Frontend..........: localhost:$Port" -ForegroundColor White
Write-Host "  - Analytics IA......: Analise em tempo real (ffmpeg + Gemini)" -ForegroundColor White
Write-Host ""
Write-Host "  SERVIDOR DE MIDIA (MediaMTX):" -ForegroundColor Cyan
Write-Host "  Para enviar stream RTMP:" -ForegroundColor Gray
Write-Host "    rtmp://localhost:1935/{nome_camera}" -ForegroundColor White
Write-Host "  Para enviar stream RTSP:" -ForegroundColor Gray
Write-Host "    rtsp://localhost:8554/{nome_camera}" -ForegroundColor White
Write-Host "  Para assistir no browser (HLS):" -ForegroundColor Gray
Write-Host "    http://localhost:8888/{nome_camera}/" -ForegroundColor White
Write-Host ""
Write-Host "  ACESSO:" -ForegroundColor Cyan
Write-Host "  URL:    http://localhost:$Port" -ForegroundColor White
Write-Host "  Email:  $AdminEmail" -ForegroundColor White
Write-Host "  Senha:  $AdminPassword" -ForegroundColor White
Write-Host ""
Write-Host "  SCRIPTS:" -ForegroundColor Cyan
Write-Host "  Iniciar:    iniciar-nexus.bat" -ForegroundColor Gray
Write-Host "  Parar:      parar-nexus.bat" -ForegroundColor Gray
Write-Host "  Atualizar:  atualizar-nexus.bat" -ForegroundColor Gray
Write-Host ""
Write-Host "  ATUALIZACOES:" -ForegroundColor Cyan
Write-Host "  1. Conecte ao GitHub: git remote add origin <URL>" -ForegroundColor Gray
Write-Host "  2. Execute: atualizar-nexus.bat" -ForegroundColor Gray
Write-Host ""

Start-Process "http://localhost:$Port"
