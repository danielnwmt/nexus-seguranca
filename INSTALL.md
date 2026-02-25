# Manual de Instalação — Bravo Monitoramento

---

## 🖥️ Instalação no Windows (Recomendado)

### Instalação Automática

1. Baixe/clone o projeto no servidor
2. Clique com botão direito em `install-windows.ps1` → **Executar com PowerShell como Administrador**

Ou via terminal (Administrador):

```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1
```

Com parâmetros personalizados:

```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1 `
  -InstallDir "D:\BravoMonitoramento" `
  -Port 8080 `
  -SupabaseUrl "https://SEU_PROJETO.supabase.co" `
  -SupabaseKey "sua_anon_key" `
  -SupabaseProjectId "seu_project_id"
```

O instalador faz tudo automaticamente:
- ✅ Verifica/instala Node.js
- ✅ Instala dependências
- ✅ Gera build de produção
- ✅ Configura servidor web
- ✅ Cria serviço Windows (com NSSM)
- ✅ Cria atalho na Área de Trabalho

### Desinstalar

```powershell
powershell -ExecutionPolicy Bypass -File desinstalar-bravo.ps1
```

---

## 🐧 Instalação no Linux/Ubuntu

### Requisitos

- **Node.js** 18+ (ou Bun)
- **npm** ou **bun**
- **Nginx** (ou outro servidor web)

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/bravo-monitoramento.git
cd bravo-monitoramento
```

### 2. Instale as Dependências

```bash
npm install
# ou
bun install
```

### 3. Configure as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_anon_key_aqui
VITE_SUPABASE_PROJECT_ID=seu_project_id
```

> As credenciais estão no painel do backend → Settings → API.

### 4. Build do Projeto

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`.

### 5. Configuração do Nginx

```nginx
server {
    listen 80;
    server_name seu-dominio.com.br;

    root /var/www/bravo-monitoramento/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 6. SSL com Certbot (Recomendado)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com.br
```

---

## 🔐 Configuração do Banco de Dados

Execute as migrations SQL no banco para criar as tabelas:
- `clients`, `cameras`, `guards`, `alarms`, `invoices`, `user_roles`, `company_settings`

Todas as tabelas possuem RLS (Row-Level Security) — somente usuários autenticados têm acesso.

## 👤 Criar o Usuário Admin

No painel de autenticação do backend → Users → **Add User**:

- **Email:** `admin@bravo.com`
- **Senha:** `sua-senha-segura`
- **Auto Confirm:** Sim

O trigger `on_auth_user_created` atribuirá automaticamente a role `admin`.

---

## 📱 Instalar como Aplicativo (PWA)

O sistema funciona como **Progressive Web App**. Para instalar:

1. Abra o sistema no **Chrome** ou **Edge**
2. Clique no ícone ⊕ na barra de endereço
3. Clique em **"Instalar"**

O app fica no Menu Iniciar com ícone próprio e sem barra do navegador.

---

## 🔑 Estrutura de Permissões

| Nível | Acesso |
|-------|--------|
| **Admin** | Acesso total ao sistema |
| **N2** | Visualização, gestão de vigilantes e câmeras (sem financeiro) |
| **N1** | Apenas visualização |

---

## ❓ Troubleshooting

| Problema | Solução |
|----------|---------|
| Tela branca | Verifique o `.env` e refaça o build |
| Erro 401 | Verifique credenciais e se o usuário foi confirmado |
| RLS bloqueando | Confirme que o usuário está logado |
| Nginx 404 | Configure `try_files` para SPA (`/index.html`) |
| PowerShell bloqueado | Execute `Set-ExecutionPolicy Bypass -Scope Process` |
| Porta em uso | Use `-Port 8080` no instalador |
