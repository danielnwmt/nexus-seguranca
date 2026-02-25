

## Plano: Banco de Dados + Autenticacao + Manual de Instalacao

### Situacao Atual
- O sistema usa apenas **dados mock** (arrays vazios em `mockData.ts`) — nada e salvo no banco
- Existe apenas 1 tabela no banco: `company_settings`
- Nao ha autenticacao — qualquer pessoa pode acessar
- 5 entidades precisam de tabelas: **clients**, **cameras**, **guards**, **alarms**, **invoices**

### Etapa 1 — Criar tabelas no banco de dados

Criar as seguintes tabelas com RLS (Row-Level Security):

```text
clients
├── id (uuid, PK)
├── name (text)
├── cpf (text)
├── email (text)
├── phone (text)
├── address (text)
├── cameras_count (integer, default 0)
├── status (text, default 'active')
├── monthly_fee (numeric)
├── payment_due_day (integer)
├── created_at (timestamptz)
└── updated_at (timestamptz)

cameras
├── id (uuid, PK)
├── name (text)
├── client_id (uuid, FK → clients)
├── stream_url (text)
├── protocol (text) — RTSP | RTMP
├── status (text, default 'online')
├── location (text)
├── resolution (text)
├── storage_path (text)
├── retention_days (integer, default 30)
├── analytics (text[]) — array de tipos
├── created_at (timestamptz)
└── updated_at (timestamptz)

guards
├── id (uuid, PK)
├── name (text)
├── cpf (text)
├── phone (text)
├── email (text)
├── shift (text) — day | night | 12x36
├── status (text, default 'active')
├── client_ids (text[])
├── hire_date (date)
├── created_at (timestamptz)
└── updated_at (timestamptz)

alarms
├── id (uuid, PK)
├── camera_id (uuid, FK → cameras)
├── camera_name (text)
├── client_name (text)
├── type (text)
├── severity (text)
├── message (text)
├── acknowledged (boolean, default false)
├── created_at (timestamptz)
└── updated_at (timestamptz)

invoices
├── id (uuid, PK)
├── client_id (uuid, FK → clients)
├── client_name (text)
├── amount (numeric)
├── due_date (date)
├── status (text, default 'pending')
├── payment_method (text)
├── bank (text)
├── paid_at (date)
├── boleto_url (text)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

Todas as tabelas terao RLS habilitado, permitindo acesso apenas para usuarios autenticados.

### Etapa 2 — Autenticacao (apenas admin)

- Criar pagina de **Login** com email e senha
- Criar rota `/login` publica e proteger todas as demais rotas
- Apenas usuarios registrados no sistema poderao acessar
- Nao haverá tela de cadastro publico — o admin sera criado manualmente
- Politicas RLS: somente `auth.uid() IS NOT NULL` pode ler/escrever

### Etapa 3 — Conectar paginas ao banco

Substituir todos os `useState(mockData)` por queries reais usando `@tanstack/react-query` + Supabase client:

- **Clients.tsx** — CRUD de clientes no banco
- **Cameras.tsx** — CRUD de cameras no banco
- **Guards.tsx** — CRUD de vigilantes no banco
- **Alarms.tsx** — CRUD de alarmes no banco
- **Financial.tsx** — CRUD de faturas no banco
- **Index.tsx** — Dashboard com dados reais do banco

### Etapa 4 — Manual de instalacao em maquina propria

Criar arquivo `INSTALL.md` na raiz do projeto com instrucoes para:

1. Requisitos do servidor (Node.js, npm/bun)
2. Clone do repositorio
3. Configuracao das variaveis de ambiente (.env)
4. Build do projeto (`npm run build`)
5. Servir com Nginx ou outro servidor web
6. Configuracao do dominio/SSL
7. Criacao do usuario admin no banco
8. Acesso inicial ao sistema

### Detalhes Tecnicos

- As queries usarao `useQuery` e `useMutation` do TanStack React Query
- Os tipos do Supabase serao regenerados automaticamente apos criar as tabelas
- RLS garantira que somente usuarios logados acessem os dados
- O `mockData.ts` sera mantido como fallback mas nao sera mais usado nas paginas
- Trigger no banco para atualizar `cameras_count` em clients quando cameras forem adicionadas/removidas

