import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, GitBranch, Clock } from 'lucide-react';
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

  const apiUrl = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    fetchVersion();
  }, []);

  const fetchVersion = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/system/version`);
      if (res.ok) {
        const data = await res.json();
        setVersionInfo(data);
      }
    } catch {
      // Server local não disponível (dev mode)
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setStatus('checking');
    setUpdateMessage('Verificando atualizações no GitHub...');

    try {
      const token = localStorage.getItem('sb-prmblhpsmuiugwpadyee-auth-token');
      let accessToken = '';
      if (token) {
        try {
          const parsed = JSON.parse(token);
          accessToken = parsed.access_token || '';
        } catch {
          accessToken = token;
        }
      }

      const res = await fetch(`${apiUrl}/api/system/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(data.status === 'updated' ? 'updated' : 'up_to_date');
        setUpdateMessage(data.message);
        
        if (data.status === 'updated') {
          toast({
            title: '✅ Sistema atualizado!',
            description: 'Recarregue a página para ver as mudanças.',
          });
          // Recarregar após 3s
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
          description: data.message,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setStatus('error');
      setUpdateMessage('Não foi possível conectar ao servidor. Verifique se o sistema está rodando no servidor local.');
      toast({
        title: 'Erro de conexão',
        description: 'Servidor não acessível. Use o script: bash atualizar-bravo.sh',
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
              disabled={updating}
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
              Você também pode atualizar via terminal: <code className="bg-muted px-1 py-0.5 rounded text-xs">bash /opt/bravo-monitoramento/atualizar-bravo.sh</code>
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
              <p className="text-sm font-mono text-foreground">v1.0.0</p>
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
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Instalação Rápida (Ubuntu)</CardTitle>
          <CardDescription className="text-xs">
            Copie e cole este comando no terminal do servidor para instalar tudo automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-3 rounded-lg border border-border">
            <code className="text-xs font-mono text-foreground break-all">
              curl -fsSL https://raw.githubusercontent.com/danielnwmt/bravo-seguran-a/main/installer/install-online.sh | sudo bash
            </code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Substitua <strong>SEU_USUARIO</strong> pelo seu usuário do GitHub. O script instala PostgreSQL, PostgREST, MediaMTX, Nginx e o frontend automaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemUpdate;
