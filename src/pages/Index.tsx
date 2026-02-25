import { useState } from 'react';
import { Camera, Users, Bell, AlertTriangle, Video, Shield } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import CameraFeed from '@/components/dashboard/CameraFeed';
import AlarmItem from '@/components/dashboard/AlarmItem';
import { mockCameras, mockClients, mockAlarms } from '@/data/mockData';

const Index = () => {
  const [alarms, setAlarms] = useState(mockAlarms);

  const onlineCameras = mockCameras.filter(c => c.status !== 'offline').length;
  const offlineCameras = mockCameras.filter(c => c.status === 'offline').length;
  const activeAlarms = alarms.filter(a => !a.acknowledged).length;

  const handleAcknowledge = (id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground font-mono">Visão geral do sistema de monitoramento</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Câmeras Online" value={onlineCameras} icon={Video} variant="success" trend={`${mockCameras.length} total`} />
        <StatsCard title="Câmeras Offline" value={offlineCameras} icon={Camera} variant="danger" />
        <StatsCard title="Clientes Ativos" value={mockClients.filter(c => c.status === 'active').length} icon={Users} />
        <StatsCard title="Alarmes Ativos" value={activeAlarms} icon={Bell} variant={activeAlarms > 0 ? 'warning' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Grid */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              Câmeras ao Vivo
            </h2>
            <span className="text-[10px] font-mono text-muted-foreground">{mockCameras.length} câmeras</span>
          </div>
          <div className="camera-grid camera-grid-3x3">
            {mockCameras.map(camera => (
              <CameraFeed key={camera.id} camera={camera} compact />
            ))}
          </div>
        </div>

        {/* Alarms Panel */}
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
            {alarms.map(alarm => (
              <AlarmItem key={alarm.id} alarm={alarm} onAcknowledge={handleAcknowledge} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
