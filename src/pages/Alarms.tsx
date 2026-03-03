import { useState } from 'react';
import { Bell, CheckCheck, Plus } from 'lucide-react';
import AlarmItem from '@/components/dashboard/AlarmItem';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTableQuery, useInsertMutation, useUpdateMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';
import { useQueryClient } from '@tanstack/react-query';

const Alarms = () => {
  const { data: alarms = [], isLoading } = useTableQuery('alarms');
  const { data: cameras = [] } = useTableQuery('cameras');
  const { data: clients = [] } = useTableQuery('clients');
  const insertMutation = useInsertMutation('alarms');
  const updateMutation = useUpdateMutation('alarms');
  const queryClient = useQueryClient();
  const isLocal = isLocalInstallation();

  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [newAlarm, setNewAlarm] = useState({ type: 'motion', severity: 'warning', message: '' });

  const clientCameras = cameras.filter((c: any) => c.client_id === selectedClientId);

  const filtered = alarms.filter((a: any) => {
    const matchSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && !a.acknowledged) ||
      (filterStatus === 'acknowledged' && a.acknowledged);
    return matchSeverity && matchStatus;
  });

  const handleAcknowledge = (id: string) => {
    updateMutation.mutate({ id, acknowledged: true } as any);
  };

  const handleAcknowledgeAll = async () => {
    const activeAlarms = alarms.filter((a: any) => !a.acknowledged);
    if (isLocal) {
      for (const alarm of activeAlarms) {
        await fetch(`${getLocalApiBase()}/rest/v1/alarms?id=eq.${(alarm as any).id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify({ acknowledged: true }),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['local', 'alarms'] });
    } else {
      for (const alarm of activeAlarms) {
        await supabase.from('alarms').update({ acknowledged: true }).eq('id', (alarm as any).id);
      }
      queryClient.invalidateQueries({ queryKey: ['alarms'] });
    }
  };

  const handleAddAlarm = () => {
    const camera = cameras.find((c: any) => c.id === selectedCameraId);
    const client = clients.find((c: any) => c.id === selectedClientId);
    if (!camera || !client) return;
    insertMutation.mutate({
      camera_id: (camera as any).id,
      camera_name: (camera as any).name,
      client_name: (client as any).name,
      type: newAlarm.type,
      severity: newAlarm.severity,
      message: newAlarm.message,
    } as any);
    setNewAlarm({ type: 'motion', severity: 'warning', message: '' });
    setSelectedClientId('');
    setSelectedCameraId('');
    setDialogOpen(false);
  };

  const activeCount = alarms.filter((a: any) => !a.acknowledged).length;

  // Map to AlarmItem format
  const mapAlarm = (a: any) => ({
    id: a.id,
    cameraId: a.camera_id || '',
    cameraName: a.camera_name || '',
    clientName: a.client_name || '',
    type: a.type,
    severity: a.severity,
    message: a.message || '',
    timestamp: a.created_at,
    acknowledged: a.acknowledged,
  });

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
              <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Alarme</Button>
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
                      {clients.map((client: any) => (
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
                      {clientCameras.map((cam: any) => (
                        <SelectItem key={cam.id} value={cam.id}>{cam.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={newAlarm.type} onValueChange={v => setNewAlarm(p => ({ ...p, type: v }))}>
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
                    <Select value={newAlarm.severity} onValueChange={v => setNewAlarm(p => ({ ...p, severity: v }))}>
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

      <div className="space-y-2 max-w-2xl">
        {filtered.map((alarm: any) => (
          <AlarmItem key={alarm.id} alarm={mapAlarm(alarm) as any} onAcknowledge={handleAcknowledge} />
        ))}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="w-12 h-12 mb-3" />
          <p className="text-sm">Nenhum alarme encontrado</p>
        </div>
      )}
    </div>
  );
};

export default Alarms;
