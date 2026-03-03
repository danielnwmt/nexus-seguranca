import { useState, useEffect, useRef } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, GitBranch, Clock, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation } from '@/hooks/useLocalApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface UpdateStep {
  step: number;
  status: 'pending' | 'running' | 'done' | 'warn' | 'error';
  message: string;
  detail?: string;
}

const STEP_LABELS: Record<number, string> = {
  1: 'Backup de configurações',
  2: 'Download do GitHub',
  3: 'Restaurar configurações',
  4: 'Instalar dependências',
  5: 'Compilar frontend',
  6: 'Reiniciar serviços',
};

const SystemUpdate = () => {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'updated' | 'up_to_date' | 'error'>('idle');
  const [updateMessage, setUpdateMessage] = useState('');
  const [errorOutput, setErrorOutput] = useState('');
  const [steps, setSteps] = useState<UpdateStep[]>([]);
  const [versionInfo, setVersionInfo] = useState<{ version: string; date: string; branch: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isPreviewEnv = host.includes('lovable.app') || host.includes('lovableproject.com');
  const updateAvailable = !isPreviewEnv;
  const blockedReason = isPreviewEnv
    ? 'Atualização por botão disponível apenas no servidor local.'
    : '';
  const apiBase = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '';
  const systemApiBase = `${apiBase}/auth/api/system`;

  useEffect(() => {
    fetchVersion();
  }, []);

  const fetchVersion = async () => {
    const urls = [
      `${systemApiBase}/version`,
      `http://${host}:8001/api/system/version`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) continue;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          console.warn(`[SystemUpdate] fetchVersion ${url} retornou content-type: ${ct} (esperado JSON)`);
          continue;
        }
        const data = await res.json();
        setVersionInfo(data);
        return;
      } catch (err) {
        console.warn(`[SystemUpdate] fetchVersion falhou em ${url}:`, err);
      }
    }
    console.info('[SystemUpdate] Nenhum servidor de versão acessível (normal no preview)');
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setStatus('checking');
    setUpdateMessage('Conectando ao servidor...');
    setErrorOutput('');
    setSteps(
      Object.entries(STEP_LABELS).map(([k, label]) => ({
        step: Number(k),
        status: 'pending',
        message: label,
      }))
    );

    try {
      if (!updateAvailable) {
        setStatus('error');
        setUpdateMessage(blockedReason || 'Atualização por botão indisponível neste ambiente.');
        toast({ title: 'Atualização indisponível', description: blockedReason || 'Use o terminal no servidor local.', variant: 'destructive' });
        return;
      }

      let accessToken: string;
      if (isLocalInstallation()) {
        const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
        accessToken = session.access_token || '';
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token || '';
      }

      const urls = [
        `${systemApiBase}/update`,
        `http://${window.location.hostname}:8001/api/system/update`,
      ];

      let connected = false;

      for (const url of urls) {
        try {
          console.log(`[SystemUpdate] Tentando SSE via ${url}`);
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          const ct = response.headers.get('content-type') || '';

          // SSE stream
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
                    setStatus(event.status === 'updated' ? 'updated' : event.status === 'up_to_date' ? 'up_to_date' : 'error');
                    setUpdateMessage(event.message);
                    if (event.output) setErrorOutput(event.output);
                    if (event.status === 'updated') {
                      toast({ title: '✅ Sistema atualizado!', description: 'Recarregue a página.' });
                      setTimeout(() => window.location.reload(), 3000);
                    } else if (event.status === 'error') {
                      toast({ title: 'Erro na atualização', description: event.message, variant: 'destructive' });
                    } else {
                      toast({ title: 'Sistema atualizado', description: event.message });
                    }
                  } else {
                    // Update step
                    setSteps(prev => prev.map(s =>
                      s.step === event.step
                        ? { ...s, status: event.status, message: event.message, detail: event.detail }
                        : s
                    ));
                    setUpdateMessage(event.message);
                  }
                } catch {}
              }
            }
            break;
          }

          // Fallback: JSON response (old server)
          if (ct.includes('application/json')) {
            connected = true;
            const data = await response.json();
            if (response.ok) {
              setStatus(data.status === 'updated' ? 'updated' : 'up_to_date');
              setUpdateMessage(data.message);
              if (data.status === 'updated') {
                toast({ title: '✅ Sistema atualizado!', description: 'Recarregue a página.' });
                setTimeout(() => window.location.reload(), 3000);
              }
            } else {
              setStatus('error');
              setUpdateMessage(data.message || 'Erro ao atualizar');
              setErrorOutput(data.output || '');
              toast({ title: 'Erro na atualização', description: data.message, variant: 'destructive' });
            }
            break;
          }
        } catch (err) {
          console.warn(`[SystemUpdate] Falha em ${url}:`, err);
        }
      }

      if (!connected) {
        setStatus('error');
        setUpdateMessage('Não foi possível conectar ao servidor.');
        setErrorOutput('Verifique se o auth-server está rodando na porta 8001.');
        toast({ title: 'Servidor não acessível', description: 'Use: bash /opt/nexus-monitoramento/atualizar-nexus.sh', variant: 'destructive' });
      }
    } catch (err: any) {
      setStatus('error');
      setUpdateMessage('Erro inesperado: ' + (err.message || ''));
      toast({ title: 'Erro na atualização', description: err.message, variant: 'destructive' });
    } finally {
      setUpdating(false);
      fetchVersion();
    }
  };

  const statusIcon = {
    idle: <RefreshCw className="w-5 h-5 text-muted-foreground" />,
    checking: <Loader2 className="w-5 h-5 text-primary animate-spin" />,
    updated: <CheckCircle2 className="w-5 h-5 text-primary" />,
    up_to_date: <CheckCircle2 className="w-5 h-5 text-primary" />,
    error: <AlertCircle className="w-5 h-5 text-destructive" />,
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualização do Sistema
          </CardTitle>
          <CardDescription className="text-xs">
            Atualize o sistema diretamente do GitHub com um clique
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Versão atual */}
          {versionInfo && versionInfo.version !== 'unknown' && (
            <div className="flex flex-wrap gap-3 items-center">
              <Badge variant="outline" className="gap-1 font-mono text-xs">
                <GitBranch className="w-3 h-3" />
                {versionInfo.branch}
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                #{versionInfo.version}
              </Badge>
              {versionInfo.date && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(versionInfo.date).toLocaleDateString('pt-BR', { 
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              )}
            </div>
          )}

          {blockedReason && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{blockedReason}</p>
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

          {/* Final status message */}
          {status !== 'idle' && status !== 'checking' && (
            <div className="space-y-2">
              <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                status === 'error' ? 'bg-destructive/10 border-destructive/20' :
                'bg-primary/10 border-primary/20'
              }`}>
                {statusIcon[status]}
                <p className="text-sm text-foreground">{updateMessage}</p>
              </div>
              {status === 'error' && errorOutput && (
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-xs font-semibold text-destructive mb-1">Saída do servidor:</p>
                  <pre className="text-[11px] text-destructive/80 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">{errorOutput}</pre>
                </div>
              )}
            </div>
          )}

          {/* Botão de atualizar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleUpdate} 
              disabled={updating || !updateAvailable}
              className="gap-2"
              size="lg"
            >
              {updating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {updating ? 'Atualizando...' : 'Atualizar Sistema'}
            </Button>
          </div>

          {/* Informação */}
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              O sistema faz <strong>git pull</strong> do repositório GitHub, reinstala dependências e reconstrói o frontend automaticamente.
              Configurações locais (.env, auth-server) são preservadas durante a atualização.
              Você também pode atualizar via terminal: <code className="bg-muted px-1 py-0.5 rounded text-xs">bash /opt/nexus-monitoramento/atualizar-nexus.sh</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Informações do sistema */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Informações do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Versão</Label>
              <p className="text-sm font-mono text-foreground">v1.0.1</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ambiente</Label>
              <p className="text-sm font-mono text-foreground">Produção</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Branch</Label>
              <p className="text-sm font-mono text-foreground">{versionInfo?.branch || 'main'}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-sm font-mono text-foreground">Online</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comando de instalação */}
      {/* Instalação Rápida Ubuntu */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">🐧 Instalação Rápida — Ubuntu</CardTitle>
          <CardDescription className="text-xs">
            Cole no terminal do servidor Ubuntu 24.04 LTS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-3 rounded-lg border border-border">
            <code className="text-xs font-mono text-foreground break-all">
              curl -fsSL https://raw.githubusercontent.com/danielnwmt/nexus-seguranca/main/installer/install-online.sh | sudo bash
            </code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Instala PostgreSQL, PostgREST, MediaMTX, Nginx e o frontend automaticamente.
          </p>
        </CardContent>
      </Card>

      {/* Instalação Rápida Windows */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">🪟 Instalação Rápida — Windows</CardTitle>
          <CardDescription className="text-xs">
            Abra o PowerShell como Administrador e cole o comando abaixo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-muted p-3 rounded-lg border border-border">
            <code className="text-xs font-mono text-foreground break-all">
              Set-ExecutionPolicy Bypass -Scope Process -Force; iwr -useb https://raw.githubusercontent.com/danielnwmt/nexus-seguranca/main/installer/install-online.ps1 | iex
            </code>
          </div>
          <p className="text-xs text-muted-foreground">
            Instala PostgreSQL, PostgREST, MediaMTX e o frontend como serviços do Windows automaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemUpdate;
