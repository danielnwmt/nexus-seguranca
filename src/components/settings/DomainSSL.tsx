import { useState, useRef } from 'react';
import { Globe, ShieldCheck, Copy, CheckCircle2, Loader2, AlertCircle, Circle, Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation } from '@/hooks/useLocalApi';

interface SSLStep {
  step: number;
  status: 'pending' | 'running' | 'done' | 'warn' | 'error';
  message: string;
  detail?: string;
}

const STEP_LABELS: Record<number, string> = {
  1: 'Instalar Certbot',
  2: 'Configurar Nginx',
  3: 'Gerar certificado SSL',
  4: 'Renovação automática',
};

const DomainSSL = () => {
  const { toast } = useToast();
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorOutput, setErrorOutput] = useState('');
  const [steps, setSteps] = useState<SSLStep[]>([]);
  const [showManual, setShowManual] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isPreviewEnv = host.includes('lovable.app') || host.includes('lovableproject.com');
  const apiBase = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '';
  const systemApiBase = `${apiBase}/auth/api/system`;

  const handleInstallSSL = async () => {
    if (!domain.trim()) {
      toast({ title: 'Erro', description: 'Digite um domínio válido.', variant: 'destructive' });
      return;
    }

    if (isPreviewEnv) {
      toast({ title: 'Indisponível', description: 'Instalação de SSL disponível apenas no servidor local.', variant: 'destructive' });
      return;
    }

    setInstalling(true);
    setStatus('running');
    setStatusMessage('Conectando ao servidor...');
    setErrorOutput('');
    setSteps(
      Object.entries(STEP_LABELS).map(([k, label]) => ({
        step: Number(k),
        status: 'pending',
        message: label,
      }))
    );

    try {
      let accessToken: string;
      if (isLocalInstallation()) {
        const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
        accessToken = session.access_token || '';
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token || '';
      }

      const urls = [`${systemApiBase}/ssl`];

      let connected = false;

      for (const url of urls) {
        try {
          console.log(`[DomainSSL] Tentando SSE via ${url}`);
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ domain: domain.trim(), email: email.trim() || undefined }),
          });

          const ct = response.headers.get('content-type') || '';

          if (ct.includes('text/event-stream') && response.body) {
            connected = true;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                  const event = JSON.parse(line.slice(6));

                  if (event.step === 'complete') {
                    setStatus(event.status === 'success' ? 'success' : 'error');
                    setStatusMessage(event.message);
                    if (event.output) setErrorOutput(event.output);
                    if (event.status === 'success') {
                      toast({ title: '✅ SSL configurado!', description: `Acesse https://${domain}` });
                    } else {
                      toast({ title: 'Erro na instalação SSL', description: event.message, variant: 'destructive' });
                    }
                  } else {
                    setSteps(prev => prev.map(s =>
                      s.step === event.step
                        ? { ...s, status: event.status, message: event.message, detail: event.detail }
                        : s
                    ));
                    setStatusMessage(event.message);
                  }
                } catch {}
              }
            }
            break;
          }

          if (ct.includes('application/json')) {
            connected = true;
            const data = await response.json();
            if (response.ok) {
              setStatus('success');
              setStatusMessage(data.message || 'SSL configurado!');
              toast({ title: '✅ SSL configurado!', description: data.message });
            } else {
              setStatus('error');
              setStatusMessage(data.error || data.message || 'Erro ao configurar SSL');
              toast({ title: 'Erro', description: data.error || data.message, variant: 'destructive' });
            }
            break;
          }
        } catch (err) {
          console.warn(`[DomainSSL] Falha em ${url}:`, err);
        }
      }

      if (!connected) {
        setStatus('error');
        setStatusMessage('Não foi possível conectar ao servidor.');
        setErrorOutput('Verifique se o serviço nexus-auth está ativo e se o proxy /auth está configurado no Nginx.');
        toast({ title: 'Servidor não acessível', description: 'Use o script manual abaixo.', variant: 'destructive' });
        setShowManual(true);
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMessage('Erro inesperado: ' + (err.message || ''));
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setInstalling(false);
    }
  };

  const sslScript = `#!/bin/bash
# Configuração automática de SSL para ${domain || 'seudominio.com.br'}
# Execute como root no servidor Ubuntu

sudo apt update && sudo apt install -y certbot python3-certbot-nginx

sudo certbot --nginx -d ${domain || 'seudominio.com.br'} -d www.${domain || 'seudominio.com.br'} --non-interactive --agree-tos --email admin@${domain || 'seudominio.com.br'}

sudo systemctl enable certbot.timer
echo "✅ SSL configurado para ${domain || 'seudominio.com.br'}"`;

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
          <CardDescription className="text-xs">
            Configure um domínio personalizado com certificado SSL automático
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Domain input */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Domínio</Label>
            <Input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="exemplo: meudominio.com.br"
              className="bg-muted border-border font-mono text-sm"
              disabled={installing}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Email (opcional, para Let's Encrypt)</Label>
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={`admin@${domain || 'seudominio.com.br'}`}
              className="bg-muted border-border font-mono text-sm"
              disabled={installing}
            />
          </div>

          {/* DNS info */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
            <p className="text-xs font-semibold text-foreground">⚠️ Antes de instalar, configure o DNS:</p>
            <div className="bg-background rounded border border-border p-2 text-xs font-mono space-y-1">
              <p><span className="text-primary">Tipo A</span> | Nome: <span className="text-foreground">@</span> | Valor: <span className="text-foreground">IP do seu servidor</span></p>
              <p><span className="text-primary">Tipo A</span> | Nome: <span className="text-foreground">www</span> | Valor: <span className="text-foreground">IP do seu servidor</span></p>
            </div>
            <p className="text-[10px] text-muted-foreground">A propagação do DNS pode levar até 72 horas. O domínio precisa apontar para o servidor antes de gerar o certificado.</p>
          </div>

          {isPreviewEnv && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">Instalação de SSL disponível apenas no servidor local.</p>
            </div>
          )}

          {/* Progress steps */}
          {steps.length > 0 && status !== 'idle' && (
            <div className="space-y-1.5 p-3 rounded-lg bg-muted/50 border border-border" ref={logRef}>
              {steps.map((s) => (
                <div key={s.step} className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    {s.status === 'pending' && <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
                    {s.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
                    {s.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                    {s.status === 'warn' && <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />}
                    {s.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium ${
                      s.status === 'error' ? 'text-destructive' :
                      s.status === 'done' ? 'text-foreground' :
                      s.status === 'running' ? 'text-primary' :
                      'text-muted-foreground'
                    }`}>
                      {s.message}
                    </p>
                    {s.detail && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5 break-all">{s.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Final status */}
          {status !== 'idle' && status !== 'running' && (
            <div className="space-y-2">
              <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                status === 'error' ? 'bg-destructive/10 border-destructive/20' :
                'bg-primary/10 border-primary/20'
              }`}>
                {status === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                )}
                <div>
                  <p className="text-sm text-foreground">{statusMessage}</p>
                  {status === 'success' && domain && (
                    <a
                      href={`https://${domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary font-mono hover:underline mt-1 block"
                    >
                      https://{domain}
                    </a>
                  )}
                </div>
              </div>
              {status === 'error' && errorOutput && (
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-xs font-semibold text-destructive mb-1">Saída do servidor:</p>
                  <pre className="text-[11px] text-destructive/80 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">{errorOutput}</pre>
                </div>
              )}
            </div>
          )}

          {/* Install button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleInstallSSL}
              disabled={installing || isPreviewEnv || !domain.trim()}
              className="gap-2"
              size="lg"
            >
              {installing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {installing ? 'Instalando SSL...' : 'Instalar SSL Automático'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={() => setShowManual(!showManual)}
            >
              <Terminal className="w-4 h-4" />
              {showManual ? 'Ocultar script' : 'Script manual'}
            </Button>
          </div>

          {/* Manual script fallback */}
          {showManual && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">Copie e execute o script abaixo no terminal do servidor Ubuntu (como root):</p>
              <div className="relative">
                <pre className="bg-muted rounded border border-border p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DomainSSL;
