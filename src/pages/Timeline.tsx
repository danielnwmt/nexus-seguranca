import { useState } from 'react';
import { Clock, Film, Bell, Brain, Calendar, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTableQuery } from '@/hooks/useSupabaseQuery';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type EventItem = {
  id: string;
  type: 'recording' | 'alarm' | 'analytics';
  title: string;
  description: string;
  cameraName: string;
  clientName: string;
  timestamp: string;
  severity?: string;
  eventType?: string;
};

const Timeline = () => {
  const { data: recordings = [] } = useTableQuery('recordings');
  const { data: alarms = [] } = useTableQuery('alarms');
  const { data: analyticsEvents = [] } = useTableQuery('analytics_events');
  const { data: cameras = [] } = useTableQuery('cameras');

  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [filterCamera, setFilterCamera] = useState<string>('all');

  // Merge all events into a single timeline
  const events: EventItem[] = [
    ...(recordings as any[]).map(r => ({
      id: r.id,
      type: 'recording' as const,
      title: `Gravação ${r.status === 'completed' ? 'finalizada' : r.status}`,
      description: `${r.duration_seconds}s • ${r.file_size_mb} MB`,
      cameraName: r.camera_name || '',
      clientName: r.client_name || '',
      timestamp: r.start_time || r.created_at,
    })),
    ...(alarms as any[]).map(a => ({
      id: a.id,
      type: 'alarm' as const,
      title: a.type === 'camera_offline' ? 'Câmera Offline' : `Alarme: ${a.type}`,
      description: a.message || '',
      cameraName: a.camera_name || '',
      clientName: a.client_name || '',
      timestamp: a.created_at,
      severity: a.severity,
    })),
    ...(analyticsEvents as any[]).map(e => ({
      id: e.id,
      type: 'analytics' as const,
      title: `Detecção: ${e.event_type}`,
      description: `Confiança: ${Math.round((e.confidence || 0) * 100)}%`,
      cameraName: e.camera_name || '',
      clientName: e.client_name || '',
      timestamp: e.created_at,
      eventType: e.event_type,
    })),
  ]
    .filter(e => {
      if (filterType !== 'all' && e.type !== filterType) return false;
      if (filterCamera !== 'all' && !e.cameraName.toLowerCase().includes(filterCamera.toLowerCase())) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.description.toLowerCase().includes(search.toLowerCase()) && !e.cameraName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 200);

  const typeIcon = (type: string) => {
    if (type === 'recording') return <Film className="w-4 h-4 text-blue-400" />;
    if (type === 'alarm') return <Bell className="w-4 h-4 text-red-400" />;
    return <Brain className="w-4 h-4 text-purple-400" />;
  };

  const typeBadge = (type: string, severity?: string) => {
    if (type === 'recording') return <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Gravação</Badge>;
    if (type === 'alarm') return <Badge variant={severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">Alarme</Badge>;
    return <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">IA</Badge>;
  };

  // Group by date
  const groupedByDate: Record<string, EventItem[]> = {};
  for (const e of events) {
    const dateKey = format(new Date(e.timestamp), 'yyyy-MM-dd');
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(e);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" /> Timeline de Eventos
        </h1>
        <p className="text-sm text-muted-foreground font-mono">Gravações, alarmes e detecções em ordem cronológica</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar eventos..." className="pl-9 bg-muted border-border" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 bg-muted border-border">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="recording">Gravações</SelectItem>
            <SelectItem value="alarm">Alarmes</SelectItem>
            <SelectItem value="analytics">Analíticos IA</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCamera} onValueChange={setFilterCamera}>
          <SelectTrigger className="w-48 bg-muted border-border">
            <SelectValue placeholder="Câmera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Câmeras</SelectItem>
            {(cameras as any[]).map(c => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum evento encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([dateKey, dateEvents]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  {format(new Date(dateKey), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </h3>
                <Badge variant="secondary" className="text-[10px]">{dateEvents.length}</Badge>
              </div>
              <div className="relative ml-4 border-l-2 border-border pl-6 space-y-3">
                {dateEvents.map(event => (
                  <div key={event.id} className="relative group">
                    <div className="absolute -left-[31px] top-2 w-3 h-3 rounded-full border-2 border-background bg-muted group-hover:bg-primary transition-colors" />
                    <Card className="hover:border-primary/30 transition-colors">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 min-w-0">
                            {typeIcon(event.type)}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{event.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                              {event.cameraName && (
                                <p className="text-xs text-muted-foreground mt-0.5">📷 {event.cameraName} {event.clientName && `• ${event.clientName}`}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {typeBadge(event.type, event.severity)}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {format(new Date(event.timestamp), 'HH:mm:ss')}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Timeline;
