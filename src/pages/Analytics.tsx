import { useState, useEffect, useCallback } from 'react';
import { Brain, ShieldAlert, Users, Car, Crosshair, Footprints, PersonStanding, ScanEye, AlertTriangle, Camera, Play, Square, Loader2, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTableQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const eventLabels: Record<string, { label: string; icon: any; color: string }> = {
  lpr: { label: 'Leitura de Placa', icon: Car, color: 'text-blue-400' },
  weapon_detection: { label: 'Arma Detectada', icon: ShieldAlert, color: 'text-red-500' },
  line_crossing: { label: 'Cruzamento de Linha', icon: Crosshair, color: 'text-yellow-400' },
  intrusion: { label: 'Intrusão de Área', icon: AlertTriangle, color: 'text-red-400' },
  loitering: { label: 'Vadiagem', icon: Footprints, color: 'text-orange-400' },
  human_car: { label: 'Humano/Carro', icon: PersonStanding, color: 'text-cyan-400' },
  fallen_person: { label: 'Pessoa Caída', icon: Users, color: 'text-red-300' },
  people_count: { label: 'Contagem de Pessoas', icon: Users, color: 'text-green-400' },
  tampering: { label: 'Sabotagem', icon: ScanEye, color: 'text-purple-400' },
};

interface AnalysisStatus {
  running: boolean;
  interval: number;
  concurrency: number;
  startedAt: string | null;
  cyclesCompleted: number;
  totalDetections: number;
  totalErrors: number;
  camerasAnalyzed: number;
  lastCycleAt: string | null;
  lastCycleDuration: number;
  rateLimited: boolean;
}

const Analytics = () => {
  const { toast } = useToast();
  const { data: cameras = [] } = useTableQuery('cameras');
  const { data: clients = [] } = useTableQuery('clients');
  const { data: companySettings } = useCompanySettings();
  const mediaServerIp = (companySettings as any)?.media_server_ip || '';
  const [events, setEvents] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [toggling, setToggling] = useState(false);

  // Fetch analysis status
  const fetchStatus = useCallback(async () => {
    if (!mediaServerIp) return;
    try {
      const resp = await fetch(`http://${mediaServerIp}:8001/api/analytics/status`);
      if (resp.ok) {
        const data = await resp.json();
        setAnalysisStatus(data);
      }
    } catch {}
  }, [mediaServerIp]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleToggleAnalysis = async () => {
    if (!mediaServerIp) {
      toast({ title: 'Configure o servidor de mídia primeiro', variant: 'destructive' });
      return;
    }
    setToggling(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { toast({ title: 'Faça login novamente', variant: 'destructive' }); return; }

      const endpoint = analysisStatus?.running ? 'stop' : 'start';
      const resp = await fetch(`http://${mediaServerIp}:8001/api/analytics/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ interval: 3 }),
      });

      if (resp.ok) {
        toast({ title: endpoint === 'start' ? '🟢 Análise contínua INICIADA' : '🔴 Análise contínua PARADA' });
        setTimeout(fetchStatus, 1000);
      } else {
        toast({ title: 'Erro ao controlar análise', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro de conexão com servidor', description: err.message, variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      let query = supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (filterType !== 'all') query = query.eq('event_type', filterType);
      if (filterClient !== 'all') query = query.eq('client_id', filterClient);
      const { data } = await query;
      setEvents(data || []);
    };
    fetchEvents();

    const channel = supabase
      .channel('analytics-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'analytics_events' }, (payload) => {
        setEvents(prev => [payload.new as any, ...prev].slice(0, 200));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filterType, filterClient]);

  const stats = Object.keys(eventLabels).map(type => {
    const count = events.filter(e => e.event_type === type).length;
    const info = eventLabels[type];
    return { type, count, ...info };
  }).sort((a, b) => b.count - a.count);

  const totalEvents = events.length;
  const criticalEvents = events.filter(e => ['weapon_detection', 'intrusion', 'fallen_person'].includes(e.event_type)).length;
  const camerasWithAnalytics = cameras.filter((c: any) => c.analytics && c.analytics.length > 0);
  const isRunning = analysisStatus?.running || false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Analíticos de IA
          </h1>
          <p className="text-sm text-muted-foreground font-mono">Detecção em tempo real via IA</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-44 h-8 text-xs bg-muted border-border">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Clientes</SelectItem>
              {clients.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-44 h-8 text-xs bg-muted border-border">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {Object.entries(eventLabels).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Painel de Controle da Análise Contínua */}
      <Card className={`border-2 ${isRunning ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border bg-card'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Análise em Tempo Real
                  <Badge variant={isRunning ? 'default' : 'secondary'} className="text-[10px]">
                    {isRunning ? 'ATIVA' : 'INATIVA'}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRunning
                    ? `Analisando ${analysisStatus?.camerasAnalyzed || 0} câmeras a cada ${analysisStatus?.interval || 3}s • ${analysisStatus?.cyclesCompleted || 0} ciclos • ${analysisStatus?.totalDetections || 0} detecções`
                    : 'Clique para iniciar a análise contínua das câmeras com IA'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isRunning && analysisStatus && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {analysisStatus.rateLimited && (
                    <Badge variant="destructive" className="text-[10px]">Rate Limited</Badge>
                  )}
                  {analysisStatus.lastCycleDuration > 0 && (
                    <span className="font-mono">{Math.round(analysisStatus.lastCycleDuration / 1000)}s/ciclo</span>
                  )}
                  {analysisStatus.totalErrors > 0 && (
                    <span className="text-destructive font-mono">{analysisStatus.totalErrors} erros</span>
                  )}
                </div>
              )}
              <Button
                onClick={handleToggleAnalysis}
                disabled={toggling}
                variant={isRunning ? 'destructive' : 'default'}
                className="gap-2"
              >
                {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isRunning ? 'Parar' : 'Iniciar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{totalEvents}</p>
            <p className="text-xs text-muted-foreground mt-1">Total de Eventos</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-destructive">{criticalEvents}</p>
            <p className="text-xs text-muted-foreground mt-1">Eventos Críticos</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{camerasWithAnalytics.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Câmeras com IA</p>
          </CardContent>
        </Card>
        {stats.filter(s => s.count > 0).slice(0, 2).map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.type} className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <Icon className={`w-5 h-5 ${s.color}`} />
                  <p className="text-3xl font-bold text-foreground">{s.count}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Analytics by type */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Eventos por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.map(s => {
              const Icon = s.icon;
              const pct = totalEvents > 0 ? (s.count / totalEvents) * 100 : 0;
              return (
                <div key={s.type} className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${s.color} shrink-0`} />
                  <span className="text-xs text-muted-foreground w-32 truncate">{s.label}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-mono text-foreground w-8 text-right">{s.count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Câmeras com IA Habilitada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {camerasWithAnalytics.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  <Camera className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  Nenhuma câmera com analíticos habilitados
                </p>
              ) : (
                camerasWithAnalytics.map((cam: any) => {
                  const client = clients.find((c: any) => c.id === cam.client_id);
                  return (
                    <div key={cam.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <div>
                        <p className="text-sm font-medium text-foreground">{cam.name}</p>
                        <p className="text-xs text-muted-foreground">{client?.name || 'Sem cliente'}</p>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                        {(cam.analytics || []).map((a: string) => (
                          <Badge key={a} variant="outline" className="text-[10px]">
                            {eventLabels[a]?.label || a}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Últimos Eventos Detectados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Câmera</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Confiança</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Nenhum evento detectado ainda
                  </TableCell>
                </TableRow>
              ) : (
                events.map((evt: any) => {
                  const info = eventLabels[evt.event_type] || { label: evt.event_type, icon: Brain, color: 'text-muted-foreground' };
                  const Icon = info.icon;
                  const confidencePct = Math.round((evt.confidence || 0) * 100);
                  return (
                    <TableRow key={evt.id}>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {format(new Date(evt.created_at), 'dd/MM HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${info.color}`} />
                          <span className="text-xs">{info.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{evt.camera_name || '—'}</TableCell>
                      <TableCell className="text-xs">{evt.client_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={confidencePct >= 80 ? 'default' : confidencePct >= 50 ? 'secondary' : 'outline'} className="text-[10px]">
                          {confidencePct}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {evt.details && Object.keys(evt.details).length > 0 ? JSON.stringify(evt.details) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
