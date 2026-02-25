import { useState } from 'react';
import { Bell, CheckCheck, Plus } from 'lucide-react';
import { mockAlarms, mockCameras, mockClients } from '@/data/mockData';
import AlarmItem from '@/components/dashboard/AlarmItem';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Alarm } from '@/types/monitoring';

const Alarms = () => {
  const [alarms, setAlarms] = useState(mockAlarms);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [newAlarm, setNewAlarm] = useState({ type: 'motion' as Alarm['type'], severity: 'warning' as Alarm['severity'], message: '' });

  const clientCameras = mockCameras.filter(c => c.clientId === selectedClientId);

  const filtered = alarms.filter(a => {
    const matchSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && !a.acknowledged) ||
      (filterStatus === 'acknowledged' && a.acknowledged);
    return matchSeverity && matchStatus;
  });

  const handleAcknowledge = (id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const handleAcknowledgeAll = () => {
    setAlarms(prev => prev.map(a => ({ ...a, acknowledged: true })));
  };

  const handleAddAlarm = () => {
    const camera = mockCameras.find(c => c.id === selectedCameraId);
    const client = mockClients.find(c => c.id === selectedClientId);
    if (!camera || !client) return;
    const alarm: Alarm = {
      id: String(alarms.length + 1),
      cameraId: camera.id,
      cameraName: camera.name,
      clientName: client.name,
      type: newAlarm.type,
      severity: newAlarm.severity,
      message: newAlarm.message,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
    setAlarms(prev => [alarm, ...prev]);
    setNewAlarm({ type: 'motion', severity: 'warning', message: '' });
    setSelectedClientId('');
    setSelectedCameraId('');
    setDialogOpen(false);
  };

  const activeCount = alarms.filter(a => !a.acknowledged).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alarmes</h1>
          <p className="text-sm text-muted-foreground font-mono">
            {activeCount > 0 ? (
              <span className="text-alarm-critical">{activeCount} alarme(s) ativo(s)</span>
            ) : (
              'Todos os alarmes foram reconhecidos'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button variant="outline" onClick={handleAcknowledgeAll} className="gap-2 border-border text-foreground hover:bg-muted">
              <CheckCheck className="w-4 h-4" /> Reconhecer Todos
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Novo Alarme
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Adicionar Alarme</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <Select value={selectedClientId} onValueChange={v => { setSelectedClientId(v); setSelectedCameraId(''); }}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                    <SelectContent>
                      {mockClients.map(client => (
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Câmera</Label>
                  <Select value={selectedCameraId} onValueChange={setSelectedCameraId} disabled={!selectedClientId}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue placeholder={selectedClientId ? 'Selecione a câmera' : 'Selecione um cliente primeiro'} /></SelectTrigger>
                    <SelectContent>
                      {clientCameras.map(cam => (
                        <SelectItem key={cam.id} value={cam.id}>{cam.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={newAlarm.type} onValueChange={v => setNewAlarm(p => ({ ...p, type: v as Alarm['type'] }))}>
                      <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motion">Movimento</SelectItem>
                        <SelectItem value="connection_lost">Conexão Perdida</SelectItem>
                        <SelectItem value="tampering">Sabotagem</SelectItem>
                        <SelectItem value="intrusion">Intrusão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Severidade</Label>
                    <Select value={newAlarm.severity} onValueChange={v => setNewAlarm(p => ({ ...p, severity: v as Alarm['severity'] }))}>
                      <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Crítico</SelectItem>
                        <SelectItem value="warning">Alerta</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Mensagem</Label>
                  <Input value={newAlarm.message} onChange={e => setNewAlarm(p => ({ ...p, message: e.target.value }))} placeholder="Descrição do alarme" className="bg-muted border-border" />
                </div>
                <Button onClick={handleAddAlarm} className="w-full" disabled={!selectedClientId || !selectedCameraId || !newAlarm.message}>
                  Adicionar Alarme
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-36 bg-muted border-border"><SelectValue placeholder="Severidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="warning">Alerta</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-muted border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="acknowledged">Reconhecidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alarm List */}
      <div className="space-y-2 max-w-2xl">
        {filtered.map(alarm => (
          <AlarmItem key={alarm.id} alarm={alarm} onAcknowledge={handleAcknowledge} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="w-12 h-12 mb-3" />
          <p className="text-sm">Nenhum alarme encontrado</p>
        </div>
      )}
    </div>
  );
};

export default Alarms;
