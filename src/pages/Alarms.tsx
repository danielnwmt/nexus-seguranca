import { useState, useEffect } from 'react';
import { Bell, CheckCheck, Plus, ClipboardCheck } from 'lucide-react';
import AlarmItem from '@/components/dashboard/AlarmItem';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTableQuery, useInsertMutation, useUpdateMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToAlarms, acknowledgeAllAlarms } from '@/services/alarmService';
import { toast } from '@/hooks/use-toast';

const HANDLING_LABELS: Record<string, string> = {
  new: 'Novo', in_progress: 'Em atendimento', resolved: 'Resolvido', false_alarm: 'Falso alarme',
};
const HANDLING_STYLES: Record<string, string> = {
  new: 'bg-muted text-muted-foreground',
  in_progress: 'bg-alarm-warning/15 text-alarm-warning',
  resolved: 'bg-primary/15 text-primary',
  false_alarm: 'bg-muted text-muted-foreground line-through',
};
const ACTION_LABELS: Record<string, string> = {
  verified_cameras: 'Verificado pelas câmeras',
  client_contacted: 'Cliente contatado',
  guard_dispatched: 'Vigilante deslocado',
  police_called: 'Polícia acionada',
  technical_issue: 'Problema técnico',
  no_action: 'Sem providência',
};

const Alarms = () => {
  const { data: alarms = [], isLoading } = useTableQuery('alarms');
  const { data: cameras = [] } = useTableQuery('cameras');
  const { data: clients = [] } = useTableQuery('clients');
  const insertMutation = useInsertMutation('alarms');
  const updateMutation = useUpdateMutation('alarms');
  const queryClient = useQueryClient();
  const isLocal = isLocalInstallation();

  // Realtime subscription for alarms (cloud only)
  useEffect(() => {
    if (isLocal) return;
    const unsubscribe = subscribeToAlarms(() => {
      queryClient.invalidateQueries({ queryKey: ['alarms'] });
    });
    return unsubscribe;
  }, [isLocal, queryClient]);

  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [newAlarm, setNewAlarm] = useState({ type: 'motion', severity: 'warning', message: '' });
  const [treatAlarm, setTreatAlarm] = useState<any>(null);
  const [treatForm, setTreatForm] = useState({ handling_status: 'in_progress', action_taken: '', handling_notes: '' });

  const openTreat = (a: any) => {
    setTreatAlarm(a);
    setTreatForm({
      handling_status: a.handling_status && a.handling_status !== 'new' ? a.handling_status : 'in_progress',
      action_taken: a.action_taken || '',
      handling_notes: a.handling_notes || '',
    });
  };

  const handleSaveTreatment = async () => {
    if (!treatAlarm) return;
    const done = treatForm.handling_status === 'resolved' || treatForm.handling_status === 'false_alarm';
    try {
      await updateMutation.mutateAsync({
        id: treatAlarm.id,
        handling_status: treatForm.handling_status,
        action_taken: treatForm.action_taken || null,
        handling_notes: treatForm.handling_notes || null,
        handled_at: new Date().toISOString(),
        acknowledged: done ? true : treatAlarm.acknowledged,
      } as any);
      toast({ title: 'Tratamento registrado' });
      setTreatAlarm(null);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    }
  };


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
    const activeAlarmIds = alarms.filter((a: any) => !a.acknowledged).map((a: any) => a.id);
    await acknowledgeAllAlarms(activeAlarmIds);
    queryClient.invalidateQueries({ queryKey: isLocal ? ['local', 'alarms'] : ['alarms'] });
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
          <div key={alarm.id} className="space-y-1">
            <AlarmItem alarm={mapAlarm(alarm) as any} onAcknowledge={handleAcknowledge} />
            <div className="flex items-center gap-2 pl-3">
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${HANDLING_STYLES[alarm.handling_status as string] || HANDLING_STYLES.new}`}>
                {HANDLING_LABELS[alarm.handling_status as string] || 'Novo'}
              </span>
              {alarm.action_taken && (
                <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[240px]">
                  {ACTION_LABELS[alarm.action_taken as string] || alarm.action_taken}
                </span>
              )}
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 ml-auto" onClick={() => openTreat(alarm)}>
                <ClipboardCheck className="w-3 h-3" /> Tratar evento
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!treatAlarm} onOpenChange={o => !o && setTreatAlarm(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Tratamento do Evento</DialogTitle>
          </DialogHeader>
          {treatAlarm && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded p-3 text-xs space-y-1">
                <p className="text-foreground font-medium">{treatAlarm.message || 'Alarme'}</p>
                <p className="text-muted-foreground font-mono">
                  {treatAlarm.camera_name || treatAlarm.client_name || '—'} • {new Date(treatAlarm.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Situação</Label>
                  <Select value={treatForm.handling_status} onValueChange={v => setTreatForm(p => ({ ...p, handling_status: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Novo</SelectItem>
                      <SelectItem value="in_progress">Em atendimento</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                      <SelectItem value="false_alarm">Falso alarme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Providência</Label>
                  <Select value={treatForm.action_taken} onValueChange={v => setTreatForm(p => ({ ...p, action_taken: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="verified_cameras">Verificado pelas câmeras</SelectItem>
                      <SelectItem value="client_contacted">Cliente contatado</SelectItem>
                      <SelectItem value="guard_dispatched">Vigilante deslocado</SelectItem>
                      <SelectItem value="police_called">Polícia acionada</SelectItem>
                      <SelectItem value="technical_issue">Problema técnico</SelectItem>
                      <SelectItem value="no_action">Sem providência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Observações do atendimento</Label>
                <Textarea rows={3} value={treatForm.handling_notes} onChange={e => setTreatForm(p => ({ ...p, handling_notes: e.target.value }))} className="bg-muted border-border" placeholder="Descreva o que foi feito" />
              </div>
              <Button className="w-full" onClick={handleSaveTreatment}>Salvar tratamento</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
