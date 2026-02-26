# Manual de Instalação — Bravo Monitoramento

## 🖥️ Instalação no Windows (Sem Docker)

### Requisitos Mínimos

| Item | Requisito |
|------|-----------|
| SO | Windows 10/11 ou Windows Server 2016+ |
| RAM | 4 GB (mínimo), 8 GB (recomendado) |
| Disco | 5 GB livres |
| Internet | Necessário para download das dependências |

### Portas Utilizadas

| Porta | Serviço |
|-------|---------|
| 80 | Frontend (Interface Web) |
| 3000 | PostgREST (API REST) |
| 5432 | PostgreSQL (Banco de Dados) |
| 8001 | Auth Server (Autenticação) |

---

## Passo a Passo

### 1️⃣ Baixar o Projeto

```powershell
# Opção A — Via Git (recomendado para atualizações futuras)
git clone https://github.com/seu-usuario/bravo-monitoramento.git C:\BravoMonitoramento
cd C:\BravoMonitoramento

# Opção B — Baixar ZIP
# Extraia o ZIP em C:\BravoMonitoramento
```

### 2️⃣ Executar o Instalador Automático

Abra o **PowerShell como Administrador** e execute:

```powershell
cd C:\BravoMonitoramento
powershell -ExecutionPolicy Bypass -File install-windows.ps1
```

O script faz **tudo automaticamente**:

1. ✅ Instala **Node.js** (se não encontrado)
2. ✅ Instala **PostgreSQL 16** silenciosamente (se não encontrado)
3. ✅ Cria o banco de dados `bravo` com todas as tabelas
4. ✅ Baixa e configura o **PostgREST** (API REST)
5. ✅ Configura o **Auth Server** (autenticação JWT)
6. ✅ Instala dependências e faz o **build do frontend**
7. ✅ Cria serviços Windows (início automático com NSSM)
8. ✅ Cria atalhos na Área de Trabalho

### 3️⃣ Acessar o Sistema

Após a instalação, acesse: **http://localhost**

| Campo | Valor |
|-------|-------|
| Email | `admin@bravo.com` |
| Senha | `admin123` |

> ⚠️ **Troque a senha do admin imediatamente após o primeiro login!**

---

## 🔧 Parâmetros Opcionais do Instalador

```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1 `
  -InstallDir "D:\BravoMonitoramento" `
  -Port 8080 `
  -ApiPort 8001 `
  -PostgRESTPort 3000 `
  -PgPassword "SuaSenhaForte123!" `
  -AdminEmail "admin@suaempresa.com" `
  -AdminPassword "senhaSegura456"
```

---

## 📦 Instalador .EXE (Inno Setup)

Para gerar o instalador `.exe`:

1. Instale o [Inno Setup 6](https://jrsoftware.org/isdl.php)
2. Abra `installer/bravo-setup.iss`
3. Compile (Ctrl+F9)
4. O arquivo `BravoMonitoramento-Setup.exe` será gerado em `installer/output/`

---

## 🔄 Atualizar o Sistema

### Via Script (recomendado)

```powershell
# Clique duplo em "atualizar-bravo.bat" ou execute:
cd C:\BravoMonitoramento
atualizar-bravo.bat
```

O script faz:
1. Para os serviços
2. Puxa atualizações do Git (`git pull`)
3. Reinstala dependências
4. Gera novo build
5. Reinicia os serviços

### Via GitHub (Lovable)

1. Conecte ao GitHub em **Configurações → Git**
2. Faça push do código do Lovable
3. Na máquina Windows, execute `atualizar-bravo.bat`

---

## 🗄️ Servidores de Gravação

O sistema permite cadastrar **servidores de gravação** para armazenar as imagens das câmeras:

1. Acesse **Configurações → Servidores**
2. Clique em **Novo Servidor**
3. Informe:
   - **Nome:** Ex: "Servidor Principal"
   - **IP:** Ex: `192.168.1.100`
   - **Caminho:** Ex: `D:\Gravacoes`
   - **Capacidade:** Em GB
4. No **cadastro do cliente**, selecione o servidor de gravação desejado

### Exemplo de Estrutura de Pastas

```
D:\Gravacoes\
├── cliente-joao-abc123\
│   ├── CAM01\
│   │   ├── 2026-02-26\
│   │   │   ├── 08-00-00.mp4
│   │   │   └── 09-00-00.mp4
│   │   └── ...
│   └── CAM02\
│       └── ...
├── cliente-maria-def456\
│   └── ...
└── ...
```

---

## 🛠️ Gerenciamento

### Iniciar/Parar Serviços

```powershell
# Iniciar tudo
C:\BravoMonitoramento\iniciar-bravo.bat

# Parar tudo
C:\BravoMonitoramento\parar-bravo.bat
```

### Via Serviços Windows (se NSSM instalado)

```powershell
# Ver status
Get-Service Bravo*

# Reiniciar
Restart-Service BravoPostgREST
Restart-Service BravoAuthServer
Restart-Service BravoFrontend
```

### Backup do Banco

```powershell
$pgBin = "C:\Program Files\PostgreSQL\16\bin"
$env:PGPASSWORD = "BravoDb2024!"
& "$pgBin\pg_dump.exe" -h localhost -U postgres bravo > "backup_$(Get-Date -Format 'yyyy-MM-dd').sql"
```

### Restaurar Backup

```powershell
& "$pgBin\psql.exe" -h localhost -U postgres -d bravo -f "backup_2026-02-26.sql"
```

---

## 📱 Instalar como App (PWA)

1. Abra **http://localhost** no Chrome ou Edge
2. Clique no ícone ⊕ na barra de endereço
3. Clique em **Instalar**
4. O app fica no Menu Iniciar sem barra do navegador

---

## 🐧 Instalação no Linux (Ubuntu/Debian)

```bash
# 1. Instalar PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib -y

# 2. Configurar banco
sudo -u postgres psql -c "CREATE DATABASE bravo;"
sudo -u postgres psql -d bravo -f installer/init-database.sql

# 3. Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Instalar PostgREST
wget https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz
tar xf postgrest-*.tar.xz
sudo mv postgrest /usr/local/bin/

# 5. Build do frontend
cd /opt/bravo-monitoramento
npm install
npm run build

# 6. Configurar Nginx
sudo apt install nginx -y
# Copie a config para /etc/nginx/sites-available/bravo
```

---

## ❓ Troubleshooting

| Problema | Solução |
|----------|---------|
| Tela branca | Verifique o `.env` e refaça o build |
| Erro 401 | Verifique se Auth Server está rodando na porta 8001 |
| PostgreSQL não conecta | Verifique o serviço: `Get-Service postgresql*` |
| Porta em uso | Altere os parâmetros `-Port`, `-ApiPort` etc |
| PowerShell bloqueado | Execute `Set-ExecutionPolicy Bypass -Scope Process` |
| Build falhou | Execute `npm install --legacy-peer-deps` e depois `npm run build` |

---

## 🗑️ Desinstalar

```powershell
powershell -ExecutionPolicy Bypass -File desinstalar-bravo.ps1
```

Remove serviços, atalhos e arquivos do sistema.
