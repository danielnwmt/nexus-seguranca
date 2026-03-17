import { Camera, Users, Bell, AlertTriangle, Video, Shield, UserX, Grid2X2, Grid3X3, LayoutGrid, Activity, Clock } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import CameraPlayer from '@/components/CameraPlayer';
import AlarmItem from '@/components/dashboard/AlarmItem';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUpdateMutation, useTableQuery } from '@/hooks/useSupabaseQuery';
import { useState, useEffect } from 'react';
import { useCameras } from '@/hooks/useCameras';

const Index = () => {
  const { cameras: filteredCameras, allCameras, clients, onlineCount, offlineCount, getClientName } = useCameras();
  const { data: alarms = [] } = useTableQuery('alarms');
  const { data: mediaServers = [] } = useTableQuery('media_servers');
  const updateAlarm = useUpdateMutation('alarms');

  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [gridLayout, setGridLayout] = useState<'2x2' | '3x3' | '4x4'>('3x3');
  const [currentTime, setCurrentTime] = useState(new Date());

  const serverList = mediaServers as any[];
  const firstServer = serverList.length > 0 ? serverList[0] : null;
  const mediaServerIp = firstServer?.ip_address || '';
  const hlsPort = firstServer?.hls_base_port || 8888;

  const displayCameras = selectedClient === 'all' ? allCameras : allCameras.filter(c => c.client_id === selectedClient);
  const activeAlarms = alarms.filter((a: any) => !a.acknowledged).length;

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAcknowledge = (id: string) => {
    updateAlarm.mutate({ id, acknowledged: true } as any);
  };

  const mapAlarm = (a: any) => ({
    id: a.id, cameraId: a.camera_id || '', cameraName: a.camera_name || '', clientName: a.client_name || '',
    type: a.type, severity: a.severity, message: a.message || '', timestamp: a.created_at, acknowledged: a.acknowledged,
  });

  const gridCols = gridLayout === '2x2' ? 4 : gridLayout === '3x3' ? 9 : 16;

  return (
    <div className="space-y-4">
      {/* Header with operation center style */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Central de Monitoramento
          </h1>
          <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
            <Activity className="w-3 h-3" />
            Sistema Ativo • {allCameras.length} câmeras registradas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-mono font-bold text-foreground tabular-nums">
              {currentTime.toLocaleTimeString('pt-BR')}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground">
              {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatsCard title="Online" value={onlineCount} icon={Video} variant="success" trend={`${allCameras.length} total`} />
        <StatsCard title="Offline" value={offlineCount} icon={Camera} variant={offlineCount > 0 ? 'danger' : 'default'} />
        <StatsCard title="Clientes" value={clients.filter((c: any) => c.status === 'active').length} icon={Users} trend={`${clients.length} total`} />
        <StatsCard title="Inativos" value={clients.filter((c: any) => c.status === 'inactive').length} icon={UserX} variant={clients.filter((c: any) => c.status === 'inactive').length > 0 ? 'danger' : 'default'} />
        <StatsCard title="Alarmes" value={activeAlarms} icon={Bell} variant={activeAlarms > 0 ? 'warning' : 'default'} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Camera grid - 3 cols */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-primary" />
                Câmeras ao Vivo
              </h2>
              <span className="text-[9px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {displayCameras.length} feeds
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-border rounded overflow-hidden bg-muted/50">
                {(['2x2', '3x3', '4x4'] as const).map(layout => (
                  <Tooltip key={layout}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setGridLayout(layout)}
                        className={`p-1.5 transition-colors ${gridLayout === layout ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        {layout === '2x2' ? <Grid2X2 className="w-3 h-3" /> : layout === '3x3' ? <Grid3X3 className="w-3 h-3" /> : <LayoutGrid className="w-3 h-3" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{layout.replace('x', '×')}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-40 h-7 text-[10px] bg-muted border-border font-mono">
                  <SelectValue placeholder="Filtrar cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={`camera-grid camera-grid-${gridLayout}`}>
            {displayCameras.slice(0, gridCols).map((cam) => (
              <CameraPlayer
                key={cam.id}
                name={cam.name}
                streamUrl={cam.stream_url || ''}
                protocol={cam.protocol}
                status={cam.status}
                resolution={cam.resolution || ''}
                compact={gridLayout !== '2x2'}
                mediaServerIp={mediaServerIp}
                hlsPort={hlsPort}
                cameraId={cam.id}
                showAnalytics={true}
              />
            ))}
          </div>
        </div>

        {/* Alarms panel - 1 col */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              Alarmes
            </h2>
            {activeAlarms > 0 && (
              <span className="text-[9px] font-mono text-destructive font-bold pulse-alarm bg-destructive/10 px-2 py-0.5 rounded">
                {activeAlarms} ativos
              </span>
            )}
          </div>
          <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin pr-1">
            {alarms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-[10px] font-mono">Nenhum alarme registrado</p>
              </div>
            ) : (
              alarms.map((alarm: any) => (
                <AlarmItem key={alarm.id} alarm={mapAlarm(alarm) as any} onAcknowledge={handleAcknowledge} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
