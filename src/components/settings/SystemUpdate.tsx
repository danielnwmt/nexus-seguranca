import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, GitBranch, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const SystemUpdate = () => {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'updated' | 'up_to_date' | 'error'>('idle');
  const [updateMessage, setUpdateMessage] = useState('');
  const [versionInfo, setVersionInfo] = useState<{ version: string; date: string; branch: string } | null>(null);

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
    try {
      let res: Response | null = null;
      try {
        res = await fetch(`${systemApiBase}/version`, { signal: AbortSignal.timeout(5000) });
      } catch {
        // Fallback direto na porta 8001
        try {
          res = await fetch(`http://${host}:8001/api/system/version`, { signal: AbortSignal.timeout(5000) });
        } catch {
          return;
        }
      }
      if (res && res.ok) {
        const data = await res.json();
        setVersionInfo(data);
      }
    } catch {
      // Servidor local não disponível
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setStatus('checking');
    setUpdateMessage('Verificando atualizações no GitHub...');

    try {
      if (!updateAvailable) {
        setStatus('error');
        setUpdateMessage(blockedReason || 'Atualização por botão indisponível neste ambiente.');
        toast({
          title: 'Atualização indisponível',
          description: blockedReason || 'Use o terminal no servidor local.',
          variant: 'destructive',
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || '';

      // Tentar via Nginx proxy primeiro, depois direto na porta 8001
      let res: Response | null = null;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      };

      try {
        res = await fetch(`${systemApiBase}/update`, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(620000), // 10min + margem
        });
      } catch {
        // Fallback: tentar direto na porta 8001
        try {
          const directUrl = `http://${window.location.hostname}:8001/api/system/update`;
          res = await fetch(directUrl, {
            method: 'POST',
            headers,
            signal: AbortSignal.timeout(620000),
          });
        } catch {
          res = null;
        }
      }

      if (!res) {
        setStatus('error');
        setUpdateMessage('Não foi possível conectar ao servidor. Verifique se o serviço está rodando. Você pode atualizar manualmente via terminal.');
        toast({
          title: 'Servidor não acessível',
          description: 'Use: bash /opt/nexus-monitoramento/atualizar-nexus.sh',
          variant: 'destructive',
        });
        return;
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        data = { status: 'error', message: 'Resposta inválida do servidor' };
      }

      if (res.ok) {
        setStatus(data.status === 'updated' ? 'updated' : 'up_to_date');
        setUpdateMessage(data.message);
        
        if (data.status === 'updated') {
          toast({
            title: '✅ Sistema atualizado!',
            description: 'Recarregue a página para ver as mudanças.',
          });
          setTimeout(() => window.location.reload(), 3000);
        } else {
          toast({
            title: 'Sistema atualizado',
            description: data.message,
          });
        }
      } else {
        setStatus('error');
        setUpdateMessage(data.message || 'Erro ao atualizar');
        toast({
          title: 'Erro na atualização',
          description: data.message || 'Verifique os logs do servidor.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setStatus('error');
      setUpdateMessage('Erro inesperado: ' + (err.message || 'Verifique se o sistema está rodando no servidor.'));
      toast({
        title: 'Erro na atualização',
        description: err.message || 'Use o script manual: bash atualizar-nexus.sh',
        variant: 'destructive',
      });
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

          {/* Status da atualização */}
          {status !== 'idle' && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border border-border">
              {statusIcon[status]}
              <p className="text-sm text-foreground">{updateMessage}</p>
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
