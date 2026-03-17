import { Camera, Users, Bell, AlertTriangle, Video, Shield, UserX, Grid2X2, Grid3X3, LayoutGrid } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import CameraPlayer from '@/components/CameraPlayer';
import AlarmItem from '@/components/dashboard/AlarmItem';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUpdateMutation, useTableQuery } from '@/hooks/useSupabaseQuery';
import { useState } from 'react';
import { useCameras } from '@/hooks/useCameras';

const Index = () => {
  const { cameras: filteredCameras, allCameras, clients, onlineCount, offlineCount, getClientName } = useCameras();
  const { data: alarms = [] } = useTableQuery('alarms');
  const { data: mediaServers = [] } = useTableQuery('media_servers');
  const updateAlarm = useUpdateMutation('alarms');

  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [gridLayout, setGridLayout] = useState<'2x2' | '3x3' | '4x4'>('3x3');

  const serverList = mediaServers as any[];
  const firstServer = serverList.length > 0 ? serverList[0] : null;
  const mediaServerIp = firstServer?.ip_address || '';

  const displayCameras = selectedClient === 'all' ? allCameras : allCameras.filter(c => c.client_id === selectedClient);
  const activeAlarms = alarms.filter((a: any) => !a.acknowledged).length;

  const handleAcknowledge = (id: string) => {
    updateAlarm.mutate({ id, acknowledged: true } as any);
  };

  const mapAlarm = (a: any) => ({
    id: a.id, cameraId: a.camera_id || '', cameraName: a.camera_name || '', clientName: a.client_name || '',
    type: a.type, severity: a.severity, message: a.message || '', timestamp: a.created_at, acknowledged: a.acknowledged,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground font-mono">Visão geral do sistema de monitoramento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Câmeras Online" value={onlineCount} icon={Video} variant="success" trend={`${allCameras.length} total`} />
        <StatsCard title="Câmeras Offline" value={offlineCount} icon={Camera} variant="danger" />
        <StatsCard title="Clientes Ativos" value={clients.filter((c: any) => c.status === 'active').length} icon={Users} trend={`${clients.length} total`} />
        <StatsCard title="Clientes Inativos" value={clients.filter((c: any) => c.status === 'inactive').length} icon={UserX} variant={clients.filter((c: any) => c.status === 'inactive').length > 0 ? 'danger' : 'default'} />
        <StatsCard title="Alarmes Ativos" value={activeAlarms} icon={Bell} variant={activeAlarms > 0 ? 'warning' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              Câmeras ao Vivo
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-border rounded-md overflow-hidden">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setGridLayout('2x2')}
                      className={`p-1.5 transition-colors ${gridLayout === '2x2' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      <Grid2X2 className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>2×2</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setGridLayout('3x3')}
                      className={`p-1.5 transition-colors ${gridLayout === '3x3' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      <Grid3X3 className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>3×3</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setGridLayout('4x4')}
                      className={`p-1.5 transition-colors ${gridLayout === '4x4' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>4×4</TooltipContent>
                </Tooltip>
              </div>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-44 h-8 text-xs bg-muted border-border">
                  <SelectValue placeholder="Filtrar por cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Clientes</SelectItem>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] font-mono text-muted-foreground">{displayCameras.length} câmeras</span>
            </div>
          </div>
          <div className={`camera-grid camera-grid-${gridLayout}`}>
            {displayCameras.map((cam) => (
              <CameraPlayer
                key={cam.id}
                name={cam.name}
                streamUrl={cam.stream_url || ''}
                protocol={cam.protocol}
                status={cam.status}
                resolution={cam.resolution || ''}
                compact={gridLayout !== '2x2'}
                mediaServerIp={mediaServerIp}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Alarmes Recentes
            </h2>
            {activeAlarms > 0 && (
              <span className="text-[10px] font-mono text-alarm-critical font-bold pulse-alarm">
                {activeAlarms} ativos
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">
            {alarms.map((alarm: any) => (
              <AlarmItem key={alarm.id} alarm={mapAlarm(alarm) as any} onAcknowledge={handleAcknowledge} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
