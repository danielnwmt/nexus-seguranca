import { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, MemoryStick, Server, RefreshCw, Wifi, WifiOff, Clock, Database, Video, Film, Brain, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';
import { useToast } from '@/hooks/use-toast';

interface SystemHealth {
  cpu: { count: number; model: string };
  memory: { total_gb: number; used_gb: number; free_gb: number; usage_percent: number };
  disk: { total_gb: number; used_gb: number; free_gb: number; usage_percent: number };
  uptime_seconds: number;
  uptime_human: string;
  services: Record<string, string>;
  recordings: { total: number; storage_mb: number; storage_gb: number };
  cameras: { total: number; online: number; offline: number };
  auto_recording: { running: boolean; active_cameras: number };
  analysis: { running: boolean; cyclesCompleted: number; totalDetections: number };
  timestamp: string;
}

const SystemHealth = () => {
  const { toast } = useToast();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);

  const fetchHealth = async () => {
    if (!isLocalInstallation()) {
      setLoading(false);
      return;
    }
    try {
      const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(`${getLocalApiBase()}/api/system/health`, { headers });
      if (res.ok) setHealth(await res.json());
    } catch (err: any) {
      console.error('Health fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCleanup = async () => {
    setCleaningUp(true);
    try {
      const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(`${getLocalApiBase()}/api/storage/cleanup`, { method: 'POST', headers });
      const data = await res.json();
      toast({ title: 'Limpeza concluída', description: `${data.deleted} gravações removidas, ${data.freed_mb || 0} MB liberados` });
      fetchHealth();
    } catch {
      toast({ title: 'Erro na limpeza', variant: 'destructive' });
    } finally {
      setCleaningUp(false);
    }
  };

  const handleToggleAutoRec = async (action: 'start' | 'stop') => {
    try {
      const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      await fetch(`${getLocalApiBase()}/api/recording/auto/${action}`, { method: 'POST', headers });
      toast({ title: action === 'start' ? 'Gravação automática iniciada' : 'Gravação automática parada' });
      fetchHealth();
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const serviceStatusBadge = (status: string) => {
    if (status === 'online' || status === 'installed') return <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">{status}</Badge>;
    if (status === 'offline') return <Badge variant="destructive" className="text-[10px]">{status}</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  };

  if (!isLocalInstallation()) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Saúde do Sistema</h1>
        <p className="text-muted-foreground">Disponível apenas em instalações locais.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Saúde do Sistema</h1>
        <p className="text-muted-foreground">Não foi possível obter dados do servidor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> Saúde do Sistema
          </h1>
          <p className="text-sm text-muted-foreground font-mono">Uptime: {health.uptime_human}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHealth}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* Resource Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" /> CPU</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{health.cpu.count} cores</p>
            <p className="text-xs text-muted-foreground truncate">{health.cpu.model}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MemoryStick className="w-4 h-4 text-primary" /> Memória RAM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg font-bold">{health.memory.usage_percent}%</span>
              <span className="text-xs text-muted-foreground">{health.memory.used_gb}/{health.memory.total_gb} GB</span>
            </div>
            <Progress value={health.memory.usage_percent} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><HardDrive className="w-4 h-4 text-primary" /> Disco</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg font-bold">{health.disk.usage_percent}%</span>
              <span className="text-xs text-muted-foreground">{health.disk.used_gb}/{health.disk.total_gb} GB</span>
            </div>
            <Progress value={health.disk.usage_percent} className={`h-2 ${health.disk.usage_percent > 90 ? '[&>div]:bg-destructive' : ''}`} />
            <p className="text-xs text-muted-foreground mt-1">{health.disk.free_gb} GB livres</p>
          </CardContent>
        </Card>
      </div>

      {/* Services */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Server className="w-4 h-4 text-primary" /> Serviços</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(health.services).map(([name, status]) => (
              <div key={name} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-xs font-medium capitalize">{name}</span>
                {serviceStatusBadge(status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workers & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Film className="w-4 h-4 text-primary" /> Gravação Automática</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {health.auto_recording.running ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-muted-foreground" />}
                <span className="text-sm">{health.auto_recording.running ? 'Ativo' : 'Inativo'}</span>
              </div>
              <Button size="sm" variant={health.auto_recording.running ? 'destructive' : 'default'} onClick={() => handleToggleAutoRec(health.auto_recording.running ? 'stop' : 'start')}>
                {health.auto_recording.running ? 'Parar' : 'Iniciar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{health.auto_recording.active_cameras} câmeras gravando</p>
            <div className="border-t border-border pt-2 mt-2">
              <p className="text-xs font-medium">Armazenamento de Gravações</p>
              <p className="text-lg font-bold">{health.recordings.total} <span className="text-xs text-muted-foreground font-normal">gravações ({health.recordings.storage_gb} GB)</span></p>
              <Button size="sm" variant="outline" className="mt-2" onClick={handleCleanup} disabled={cleaningUp}>
                {cleaningUp ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <HardDrive className="w-3 h-3 mr-1" />}
                Limpar Expiradas
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Análise IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              {health.analysis.running ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm">{health.analysis.running ? 'Ativo' : 'Inativo'}</span>
            </div>
            <p className="text-xs text-muted-foreground">Ciclos: {health.analysis.cyclesCompleted}</p>
            <p className="text-xs text-muted-foreground">Detecções: {health.analysis.totalDetections}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemHealth;
