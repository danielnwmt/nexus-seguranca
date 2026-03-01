import { useState } from 'react';
import { Globe, ShieldCheck, Copy, Terminal, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const DomainSSL = () => {
  const { toast } = useToast();
  const [domain, setDomain] = useState('');
  const [generated, setGenerated] = useState(false);
  const [step, setStep] = useState(0);

  const handleGenerate = () => {
    if (!domain.trim()) {
      toast({ title: 'Erro', description: 'Digite um domínio válido.', variant: 'destructive' });
      return;
    }
    setGenerated(true);
    setStep(1);
    toast({ title: 'Configuração gerada', description: `Siga os passos para configurar ${domain}` });
  };

  const sslScript = `#!/bin/bash
# Configuração automática de SSL para ${domain || 'seudominio.com.br'}
# Execute como root no servidor Ubuntu

# 1. Instalar Certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# 2. Configurar Nginx para o domínio
sudo tee /etc/nginx/sites-available/${domain || 'nexus'} > /dev/null <<EOF
server {
    listen 80;
    server_name ${domain || 'seudominio.com.br'} www.${domain || 'seudominio.com.br'};

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/${domain || 'nexus'} /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 3. Gerar certificado SSL
sudo certbot --nginx -d ${domain || 'seudominio.com.br'} -d www.${domain || 'seudominio.com.br'} --non-interactive --agree-tos --email admin@${domain || 'seudominio.com.br'}

# 4. Renovação automática
sudo systemctl enable certbot.timer
echo "✅ SSL configurado com sucesso para ${domain || 'seudominio.com.br'}"`;

  const copyScript = () => {
    navigator.clipboard.writeText(sslScript);
    toast({ title: 'Script copiado!' });
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            Domínio e SSL
          </CardTitle>
          <CardDescription className="text-xs">Configure um domínio personalizado com certificado SSL automático</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Domínio</Label>
            <div className="flex gap-2">
              <Input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="exemplo: meudominio.com.br"
                className="bg-muted border-border font-mono text-sm"
              />
              <Button onClick={handleGenerate} className="gap-2 shrink-0">
                <ShieldCheck className="w-4 h-4" />
                Gerar SSL
              </Button>
            </div>
          </div>

          {generated && (
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">Passos para configurar</h3>

              <div className="space-y-3">
                {/* Step 1: DNS */}
                <Card className={`border ${step >= 1 ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted'}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">1</Badge>
                      <p className="text-sm font-medium text-foreground">Configurar DNS</p>
                      {step > 1 && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
                    </div>
                    <p className="text-xs text-muted-foreground">No seu registrador de domínio, crie os seguintes registros:</p>
                    <div className="bg-background rounded border border-border p-2 text-xs font-mono space-y-1">
                      <p><span className="text-primary">Tipo A</span> | Nome: <span className="text-foreground">@</span> | Valor: <span className="text-foreground">IP da sua VPS</span></p>
                      <p><span className="text-primary">Tipo A</span> | Nome: <span className="text-foreground">www</span> | Valor: <span className="text-foreground">IP da sua VPS</span></p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStep(2)}>Já configurei o DNS →</Button>
                  </CardContent>
                </Card>

                {/* Step 2: Script */}
                <Card className={`border ${step >= 2 ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted'}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">2</Badge>
                      <p className="text-sm font-medium text-foreground">Executar script no servidor</p>
                      {step > 2 && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
                    </div>
                    <p className="text-xs text-muted-foreground">Copie e execute o script abaixo no terminal do servidor Ubuntu (como root):</p>
                    <div className="relative">
                      <pre className="bg-background rounded border border-border p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {sslScript}
                      </pre>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute top-2 right-2 h-7 text-xs gap-1"
                        onClick={copyScript}
                      >
                        <Copy className="w-3 h-3" />
                        Copiar
                      </Button>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStep(3)}>Executei o script →</Button>
                  </CardContent>
                </Card>

                {/* Step 3: Done */}
                <Card className={`border ${step >= 3 ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-muted'}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">3</Badge>
                      <p className="text-sm font-medium text-foreground">Verificar</p>
                      {step >= 3 && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
                    </div>
                    {step >= 3 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-green-600">✅ Configuração concluída! Acesse:</p>
                        <a
                          href={`https://${domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary font-mono hover:underline"
                        >
                          https://{domain}
                        </a>
                        <p className="text-[10px] text-muted-foreground">A propagação do DNS pode levar até 72 horas.</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aguardando conclusão dos passos anteriores</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DomainSSL;
