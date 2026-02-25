import { Camera, Users, Bell, AlertTriangle, Video, Shield } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import CameraFeed from '@/components/dashboard/CameraFeed';
import AlarmItem from '@/components/dashboard/AlarmItem';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTableQuery, useUpdateMutation } from '@/hooks/useSupabaseQuery';
import { useState } from 'react';

const Index = () => {
  const { data: cameras = [] } = useTableQuery('cameras');
  const { data: clients = [] } = useTableQuery('clients');
  const { data: alarms = [] } = useTableQuery('alarms');
  const updateAlarm = useUpdateMutation('alarms');

  const [selectedClient, setSelectedClient] = useState<string>('all');

  const filteredCameras = selectedClient === 'all' ? cameras : cameras.filter((c: any) => c.client_id === selectedClient);
  const onlineCameras = filteredCameras.filter((c: any) => c.status !== 'offline').length;
  const offlineCameras = filteredCameras.filter((c: any) => c.status === 'offline').length;
  const activeAlarms = alarms.filter((a: any) => !a.acknowledged).length;

  const handleAcknowledge = (id: string) => {
    updateAlarm.mutate({ id, acknowledged: true } as any);
  };

  const mapCamera = (c: any) => {
    const client = clients.find((cl: any) => cl.id === c.client_id);
    return {
      id: c.id, name: c.name, clientId: c.client_id || '', clientName: client?.name || '',
      streamUrl: c.stream_url || '', protocol: c.protocol || 'RTSP', status: c.status || 'online',
      location: c.location || '', resolution: c.resolution || '', storagePath: c.storage_path || '',
      retentionDays: c.retention_days || 30, analytics: c.analytics || [],
    };
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Câmeras Online" value={onlineCameras} icon={Video} variant="success" trend={`${filteredCameras.length} total`} />
        <StatsCard title="Câmeras Offline" value={offlineCameras} icon={Camera} variant="danger" />
        <StatsCard title="Clientes Ativos" value={clients.filter((c: any) => c.status === 'active').length} icon={Users} />
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
              <span className="text-[10px] font-mono text-muted-foreground">{filteredCameras.length} câmeras</span>
            </div>
          </div>
          <div className="camera-grid camera-grid-3x3">
            {filteredCameras.map((camera: any) => (
              <CameraFeed key={camera.id} camera={mapCamera(camera) as any} compact />
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
