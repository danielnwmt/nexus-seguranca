# Manual de Instalação — Bravo Monitoramento

---

## 🖥️ Instalação Completa no Windows (Frontend + Banco de Dados)

### Requisitos

- **Windows 10/11 ou Windows Server 2019+**
- **Docker Desktop** (para o banco de dados)
- **Git** (para clonar o Supabase)
- O instalador cuida do restante (Node.js, dependências, build)

---

### Etapa 1 — Instalar Docker Desktop

1. Baixe em: https://www.docker.com/products/docker-desktop/
2. Instale e reinicie o computador
3. Abra o Docker Desktop e aguarde iniciar
4. Confirme no terminal:

```powershell
docker --version
docker compose version
```

---

### Etapa 2 — Instalar o Banco de Dados (Supabase Self-Hosted)

```powershell
# Clonar o repositório oficial do Supabase
git clone --depth 1 https://github.com/supabase/supabase.git C:\Supabase
cd C:\Supabase\docker

# Copiar o arquivo de configuração
copy .env.example .env
```

**Edite o arquivo `C:\Supabase\docker\.env`** e altere estas variáveis obrigatórias:

```env
# ALTERE ESTAS CHAVES — use valores aleatórios e seguros!
POSTGRES_PASSWORD=sua-senha-forte-aqui
JWT_SECRET=seu-jwt-secret-com-pelo-menos-32-caracteres
ANON_KEY=gere-em-https://supabase.com/docs/guides/self-hosting#api-keys
SERVICE_ROLE_KEY=gere-em-https://supabase.com/docs/guides/self-hosting#api-keys

# Defina o site URL para seu domínio ou IP
SITE_URL=http://localhost:3000
API_EXTERNAL_URL=http://localhost:8000
SUPABASE_PUBLIC_URL=http://localhost:8000
```

> ⚠️ **Gerar as chaves JWT:** Acesse https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys e siga as instruções para gerar `ANON_KEY` e `SERVICE_ROLE_KEY` a partir do seu `JWT_SECRET`.

**Iniciar o banco:**

```powershell
cd C:\Supabase\docker
docker compose up -d
```

Aguarde todos os containers subirem (~2-5 minutos na primeira vez).

**Verificar se está rodando:**

```powershell
docker compose ps
```

O painel do Supabase estará disponível em: **http://localhost:8000**

---

### Etapa 3 — Criar as Tabelas do Sistema

Acesse **http://localhost:8000** → SQL Editor e execute o SQL abaixo:

```sql
-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'n1', 'n2');

-- Tabela de roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'n1',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função de verificação de role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- Tabela de clientes
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text,
  email text,
  phone text,
  address text,
  cameras_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  monthly_fee numeric,
  payment_due_day integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Tabela de câmeras
CREATE TABLE public.cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  stream_url text,
  protocol text NOT NULL DEFAULT 'RTSP',
  status text NOT NULL DEFAULT 'online',
  location text,
  resolution text DEFAULT '1920x1080',
  storage_path text,
  retention_days integer NOT NULL DEFAULT 30,
  analytics text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

-- Tabela de vigilantes
CREATE TABLE public.guards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text,
  phone text,
  email text,
  shift text NOT NULL DEFAULT 'day',
  status text NOT NULL DEFAULT 'active',
  client_ids text[] DEFAULT '{}',
  hire_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guards ENABLE ROW LEVEL SECURITY;

-- Tabela de alarmes
CREATE TABLE public.alarms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id uuid REFERENCES public.cameras(id) ON DELETE SET NULL,
  camera_name text,
  client_name text,
  type text NOT NULL DEFAULT 'motion',
  severity text NOT NULL DEFAULT 'warning',
  message text,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;

-- Tabela de faturas
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  bank text,
  paid_at date,
  boleto_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Tabela de configurações da empresa
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Bravo Monitoramento',
  cnpj text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Inserir registro padrão de configuração
INSERT INTO public.company_settings (name) VALUES ('Bravo Monitoramento');

-- RLS Policies (todas as tabelas — apenas usuários autenticados)
CREATE POLICY "auth_crud" ON public.clients FOR ALL USING (is_authenticated()) WITH CHECK (is_authenticated());
CREATE POLICY "auth_crud" ON public.cameras FOR ALL USING (is_authenticated()) WITH CHECK (is_authenticated());
CREATE POLICY "auth_crud" ON public.guards FOR ALL USING (is_authenticated()) WITH CHECK (is_authenticated());
CREATE POLICY "auth_crud" ON public.alarms FOR ALL USING (is_authenticated()) WITH CHECK (is_authenticated());
CREATE POLICY "auth_crud" ON public.invoices FOR ALL USING (is_authenticated()) WITH CHECK (is_authenticated());
CREATE POLICY "auth_crud" ON public.company_settings FOR ALL USING (is_authenticated()) WITH CHECK (is_authenticated());
CREATE POLICY "auth_read_roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "admin_manage_roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.cameras FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.guards FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.alarms FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Trigger para contar câmeras por cliente
CREATE OR REPLACE FUNCTION public.update_client_cameras_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.clients SET cameras_count = (SELECT COUNT(*) FROM public.cameras WHERE client_id = NEW.client_id) WHERE id = NEW.client_id;
  END IF;
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE public.clients SET cameras_count = (SELECT COUNT(*) FROM public.cameras WHERE client_id = OLD.client_id) WHERE id = OLD.client_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER update_cameras_count AFTER INSERT OR UPDATE OR DELETE ON public.cameras FOR EACH ROW EXECUTE FUNCTION update_client_cameras_count();

-- Trigger para atribuir role admin a novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'); RETURN NEW; END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

### Etapa 4 — Criar o Usuário Admin

No painel Supabase (**http://localhost:8000**) → Authentication → Users → **Add User**:

- **Email:** `admin@bravo.com`
- **Senha:** sua senha segura
- **Auto Confirm:** Sim

---

### Etapa 5 — Instalar o Frontend

Execute como Administrador:

```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1 `
  -SupabaseUrl "http://localhost:8000" `
  -SupabaseKey "SUA_ANON_KEY_GERADA" `
  -SupabaseProjectId "default"
```

Ou simplesmente:

```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1
```

O script vai perguntar as credenciais interativamente.

---

### Etapa 6 — Acessar o Sistema

Abra **http://localhost** (ou a porta configurada) e faça login com as credenciais do admin.

---

## 🔄 Gerenciamento do Banco

### Iniciar/Parar o banco:

```powershell
cd C:\Supabase\docker

# Iniciar
docker compose up -d

# Parar
docker compose stop

# Ver status
docker compose ps

# Ver logs
docker compose logs -f
```

### Backup do banco:

```powershell
docker exec supabase-db pg_dump -U postgres > backup_%date:~-4%-%date:~3,2%-%date:~0,2%.sql
```

### Restaurar backup:

```powershell
docker exec -i supabase-db psql -U postgres < backup.sql
```

---

## 🐧 Instalação no Linux/Ubuntu

### Requisitos

- **Docker** e **Docker Compose**
- **Node.js** 18+
- **Nginx**

### Banco de dados:

```bash
git clone --depth 1 https://github.com/supabase/supabase.git /opt/supabase
cd /opt/supabase/docker
cp .env.example .env
# Edite o .env com suas chaves
nano .env
docker compose up -d
```

### Frontend:

```bash
git clone https://github.com/seu-usuario/bravo-monitoramento.git
cd bravo-monitoramento
npm install
# Configure o .env apontando para o Supabase local
npm run build
```

### Nginx:

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

### SSL:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com.br
```

---

## 📱 Instalar como Aplicativo (PWA)

1. Abra o sistema no **Chrome** ou **Edge**
2. Clique no ícone ⊕ na barra de endereço → **Instalar**
3. O app fica no Menu Iniciar sem barra do navegador

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
| Docker não inicia | Verifique se o Docker Desktop está rodando |
| Porta 8000 em uso | Altere `API_EXTERNAL_URL` no `.env` do Supabase |
| PowerShell bloqueado | Execute `Set-ExecutionPolicy Bypass -Scope Process` |
| Containers caindo | Execute `docker compose logs` para ver erros |

---

## 🗑️ Desinstalar

### Frontend:
```powershell
powershell -ExecutionPolicy Bypass -File desinstalar-bravo.ps1
```

### Banco de dados:
```powershell
cd C:\Supabase\docker
docker compose down -v
```
