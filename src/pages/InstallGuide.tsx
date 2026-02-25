import { Book, Terminal, Monitor, Shield, Globe, Copy, CheckCircle2, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const CodeBlock = ({ children, label }: { children: string; label?: string }) => {
  const { toast } = useToast();
  const copy = () => {
    navigator.clipboard.writeText(children);
    toast({ title: 'Copiado!' });
  };
  return (
    <div className="relative group">
      {label && <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{label}</span>}
      <div className="bg-muted border border-border rounded-lg p-3 font-mono text-xs text-foreground whitespace-pre-wrap overflow-x-auto">
        {children}
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={copy}>
          <Copy className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{n}</div>
    <div className="space-y-2 flex-1">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </div>
  </div>
);

const InstallGuide = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Book className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manual de Instalação</h1>
          <p className="text-sm text-muted-foreground font-mono">Deploy do Bravo Monitoramento em servidor local</p>
        </div>
      </div>

      {/* Requisitos */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Server className="w-4 h-4" /> Requisitos Mínimos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Hardware</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>CPU: 2 cores (4 recomendado)</li>
                <li>RAM: 4 GB mínimo (8 GB recomendado)</li>
                <li>Disco: 50 GB SSD</li>
                <li>Rede: IP fixo na rede local</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Software</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Node.js 18+ (recomendado: 20 LTS)</li>
                <li>npm ou yarn</li>
                <li>Git</li>
                <li>Nginx ou Apache (proxy reverso)</li>
                <li>Certificado SSL (Let's Encrypt gratuito)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UBUNTU */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-600 text-white">Ubuntu / Debian</Badge>
            <Terminal className="w-4 h-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-base">Instalação no Ubuntu Server 22.04+</CardTitle>
          <CardDescription className="text-xs">Recomendado para produção</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Step n={1} title="Atualizar o sistema e instalar dependências">
            <CodeBlock>{`sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx`}</CodeBlock>
          </Step>

          <Step n={2} title="Instalar o Node.js 20 LTS">
            <CodeBlock>{`curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v`}</CodeBlock>
          </Step>

          <Step n={3} title="Clonar o projeto e instalar dependências">
            <CodeBlock>{`cd /opt
sudo git clone <URL_DO_REPOSITORIO> bravo-monitoramento
cd bravo-monitoramento
sudo npm install`}</CodeBlock>
          </Step>

          <Step n={4} title="Configurar variáveis de ambiente">
            <CodeBlock label=".env">{`# Criar arquivo .env na raiz do projeto
sudo nano .env

# Adicionar as variáveis:
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon`}</CodeBlock>
          </Step>

          <Step n={5} title="Compilar para produção">
            <CodeBlock>{`sudo npm run build
# Os arquivos serão gerados em /opt/bravo-monitoramento/dist/`}</CodeBlock>
          </Step>

          <Step n={6} title="Configurar o Nginx como proxy reverso">
            <CodeBlock label="/etc/nginx/sites-available/bravo">{`server {
    listen 80;
    server_name seu-dominio.com.br;  # ou IP do servidor

    root /opt/bravo-monitoramento/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache de assets estáticos
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}`}</CodeBlock>
            <CodeBlock>{`sudo ln -s /etc/nginx/sites-available/bravo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx`}</CodeBlock>
          </Step>

          <Step n={7} title="(Opcional) Habilitar HTTPS com Let's Encrypt">
            <CodeBlock>{`sudo certbot --nginx -d seu-dominio.com.br
sudo systemctl reload nginx`}</CodeBlock>
          </Step>

          <Step n={8} title="Criar serviço systemd para atualizações automáticas">
            <CodeBlock label="/etc/systemd/system/bravo-update.service">{`[Unit]
Description=Bravo Monitoramento - Auto Update
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/opt/bravo-monitoramento
ExecStart=/bin/bash -c 'git pull && npm install && npm run build'

[Install]
WantedBy=multi-user.target`}</CodeBlock>
          </Step>

          <Step n={9} title="Verificar acesso">
            <p>Acesse no navegador: <code className="bg-muted px-2 py-0.5 rounded text-xs">http://IP_DO_SERVIDOR</code></p>
            <CodeBlock>{`# Verificar se Nginx está rodando
sudo systemctl status nginx

# Ver logs em caso de erro
sudo tail -f /var/log/nginx/error.log`}</CodeBlock>
          </Step>
        </CardContent>
      </Card>

      {/* WINDOWS */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-600 text-white">Windows Server</Badge>
            <Monitor className="w-4 h-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-base">Instalação no Windows Server 2019+</CardTitle>
          <CardDescription className="text-xs">Ambiente Windows com IIS</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Step n={1} title="Instalar Node.js">
            <p>Baixe e instale o <strong>Node.js 20 LTS</strong> em <code className="bg-muted px-2 py-0.5 rounded text-xs">https://nodejs.org</code></p>
            <p>Marque a opção de adicionar ao PATH durante a instalação.</p>
          </Step>

          <Step n={2} title="Instalar Git">
            <p>Baixe e instale em <code className="bg-muted px-2 py-0.5 rounded text-xs">https://git-scm.com</code></p>
          </Step>

          <Step n={3} title="Clonar e compilar o projeto (PowerShell como Admin)">
            <CodeBlock>{`cd C:\\
git clone <URL_DO_REPOSITORIO> bravo-monitoramento
cd bravo-monitoramento
npm install
npm run build`}</CodeBlock>
          </Step>

          <Step n={4} title="Configurar variáveis de ambiente">
            <CodeBlock label="C:\bravo-monitoramento\.env">{`VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon`}</CodeBlock>
          </Step>

          <Step n={5} title="Instalar e configurar o IIS">
            <p>No <strong>Gerenciador do Servidor</strong>:</p>
            <ul className="list-disc list-inside text-xs space-y-1">
              <li>Adicionar Função → <strong>Servidor Web (IIS)</strong></li>
              <li>Instalar o módulo <strong>URL Rewrite</strong> (download em iis.net)</li>
            </ul>
          </Step>

          <Step n={6} title="Configurar site no IIS">
            <ul className="list-disc list-inside text-xs space-y-1">
              <li>Abrir o <strong>Gerenciador do IIS</strong></li>
              <li>Criar novo site apontando para <code className="bg-muted px-1 rounded">C:\bravo-monitoramento\dist</code></li>
              <li>Definir a porta (80 ou 443)</li>
              <li>Vincular o IP ou hostname desejado</li>
            </ul>
          </Step>

          <Step n={7} title="Configurar URL Rewrite para SPA">
            <CodeBlock label="C:\bravo-monitoramento\dist\web.config">{`<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json" />
    </staticContent>
  </system.webServer>
</configuration>`}</CodeBlock>
          </Step>

          <Step n={8} title="Liberar firewall">
            <CodeBlock>{`# PowerShell como Administrador
New-NetFirewallRule -DisplayName "Bravo HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "Bravo HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow`}</CodeBlock>
          </Step>

          <Step n={9} title="Verificar acesso">
            <p>Acesse no navegador: <code className="bg-muted px-2 py-0.5 rounded text-xs">http://IP_DO_SERVIDOR</code></p>
          </Step>
        </CardContent>
      </Card>

      {/* Pós-instalação */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Pós-Instalação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-muted rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-foreground flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Acesso na rede</p>
              <p className="text-xs text-muted-foreground">Todos os dispositivos na mesma rede poderão acessar via IP ou domínio configurado.</p>
            </div>
            <div className="bg-muted rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-foreground flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> Segurança</p>
              <p className="text-xs text-muted-foreground">Configure HTTPS, firewall e mantenha o sistema atualizado.</p>
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground"><strong>Credenciais padrão:</strong></p>
            <ul className="text-xs text-muted-foreground list-disc list-inside mt-1">
              <li>Email: <code className="bg-muted px-1 rounded">admin@bravo.com</code></li>
              <li>Senha: <code className="bg-muted px-1 rounded">1234</code></li>
              <li className="text-destructive">⚠ Altere a senha padrão após o primeiro acesso!</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallGuide;
