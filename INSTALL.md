# Manual de Instalação — Bravo Monitoramento

## Requisitos

- **Node.js** 18+ (ou Bun)
- **npm** ou **bun**
- **Nginx** (ou outro servidor web para produção)
- **Supabase** (projeto próprio ou self-hosted)

---

## 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/bravo-monitoramento.git
cd bravo-monitoramento
```

## 2. Instale as Dependências

```bash
npm install
# ou
bun install
```

## 3. Configure as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_anon_key_aqui
VITE_SUPABASE_PROJECT_ID=seu_project_id
```

> As credenciais estão no painel do Supabase → Settings → API.

## 4. Configure o Banco de Dados

Execute as migrations SQL no Supabase (SQL Editor) para criar as tabelas:
- `clients`, `cameras`, `guards`, `alarms`, `invoices`, `user_roles`, `company_settings`

Todas as tabelas possuem RLS (Row-Level Security) habilitado — somente usuários autenticados têm acesso.

## 5. Crie o Usuário Admin

No Supabase Dashboard → Authentication → Users → **Add User**:

- **Email:** `admin@bravo.com`
- **Senha:** `sua-senha-segura`
- **Auto Confirm:** Sim

O trigger `on_auth_user_created` atribuirá automaticamente a role `admin` ao novo usuário.

## 6. Build do Projeto

```bash
npm run build
# ou
bun run build
```

Os arquivos serão gerados na pasta `dist/`.

## 7. Configuração do Nginx

Exemplo de configuração para servir o app:

```nginx
server {
    listen 80;
    server_name seu-dominio.com.br;

    root /var/www/bravo-monitoramento/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Otimizações
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 8. SSL com Certbot (Opcional, Recomendado)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com.br
```

## 9. Acesse o Sistema

Abra o navegador em `https://seu-dominio.com.br` e faça login com as credenciais do admin criado no passo 5.

---

## Estrutura de Permissões

| Nível | Acesso |
|-------|--------|
| **Admin** | Acesso total ao sistema |
| **N2** | Visualização, gestão de vigilantes e câmeras (sem financeiro) |
| **N1** | Apenas visualização |

---

## Troubleshooting

- **Tela branca:** Verifique se o `.env` está correto e o build foi feito após configurar
- **Erro 401:** Verifique as credenciais do Supabase e se o usuário foi confirmado
- **RLS bloqueando:** Certifique-se de que o usuário está logado antes de acessar dados
- **Nginx 404:** Verifique se `try_files` está configurado para SPA (`/index.html`)
