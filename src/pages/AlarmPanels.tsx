import { useState } from 'react';
import { Plus, Siren, Pencil, Trash2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';
import { toast } from '@/hooks/use-toast';

interface PanelForm {
  id?: string;
  name: string;
  client_id: string;
  manufacturer: string;
  model: string;
  account_number: string;
  partitions: string;
  zones_count: string;
  ip_address: string;
  port: string;
  phone: string;
  notes: string;
  status: string;
}

const emptyForm: PanelForm = {
  name: '', client_id: '', manufacturer: '', model: '', account_number: '',
  partitions: '1', zones_count: '8', ip_address: '', port: '9009', phone: '', notes: '', status: 'active',
};

const MANUFACTURERS = ['Intelbras', 'JFL', 'Positivo', 'Paradox', 'DSC', 'Ademco/Honeywell', 'Outro'];

const AlarmPanels = () => {
  const { data: panels = [], isLoading } = useTableQuery('alarm_panels');
  const { data: clients = [] } = useTableQuery('clients');
  const { data: zones = [] } = useTableQuery('alarm_zones');
  const insertPanel = useInsertMutation('alarm_panels');
  const updatePanel = useUpdateMutation('alarm_panels');
  const deletePanel = useDeleteMutation('alarm_panels');
  const insertZone = useInsertMutation('alarm_zones');
  const deleteZone = useDeleteMutation('alarm_zones');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PanelForm>(emptyForm);
  const [zonesPanelId, setZonesPanelId] = useState<string | null>(null);
  const [newZone, setNewZone] = useState({ zone_number: '', name: '', zone_type: 'perimeter' });

  const set = (k: keyof PanelForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  const openNew = () => { setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setForm({
      id: p.id, name: p.name || '', client_id: p.client_id || '', manufacturer: p.manufacturer || '',
      model: p.model || '', account_number: p.account_number || '', partitions: String(p.partitions ?? 1),
      zones_count: String(p.zones_count ?? 8), ip_address: p.ip_address || '', port: p.port ? String(p.port) : '',
      phone: p.phone || '', notes: p.notes || '', status: p.status || 'active',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const client = (clients as any[]).find(c => c.id === form.client_id);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      client_id: form.client_id || null,
      client_name: client?.name || null,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
      account_number: form.account_number || null,
      partitions: parseInt(form.partitions) || 1,
      zones_count: parseInt(form.zones_count) || 8,
      ip_address: form.ip_address || null,
      port: form.port ? parseInt(form.port) : null,
      phone: form.phone || null,
      notes: form.notes || null,
      status: form.status,
    };
    try {
      if (form.id) await updatePanel.mutateAsync({ id: form.id, ...payload } as any);
      else await insertPanel.mutateAsync(payload);
      toast({ title: form.id ? 'Central atualizada' : 'Central cadastrada' });
      setDialogOpen(false);
      setForm(emptyForm);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    }
  };

  const handleAddZone = async () => {
    if (!zonesPanelId || !newZone.zone_number || !newZone.name.trim()) return;
    try {
      await insertZone.mutateAsync({
        panel_id: zonesPanelId,
        zone_number: parseInt(newZone.zone_number),
        name: newZone.name.trim(),
        zone_type: newZone.zone_type,
      });
      setNewZone({ zone_number: '', name: '', zone_type: 'perimeter' });
    } catch (e: any) {
      toast({ title: 'Erro ao adicionar zona', description: e.message, variant: 'destructive' });
    }
  };

  const panelZones = (zones as any[])
    .filter(z => z.panel_id === zonesPanelId)
    .sort((a, b) => a.zone_number - b.zone_number);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Siren className="w-5 h-5 text-primary" /> Centrais de Alarme
          </h1>
          <p className="text-sm text-muted-foreground font-mono">{panels.length} central(is) cadastrada(s)</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova Central</Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Central</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fabricante</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Comunicação</TableHead>
              <TableHead>Zonas</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(panels as any[]).map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.client_name || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{[p.manufacturer, p.model].filter(Boolean).join(' ') || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{p.account_number || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{p.ip_address ? `${p.ip_address}:${p.port || ''}` : (p.phone || '—')}</TableCell>
                <TableCell className="font-mono text-xs">{p.zones_count}</TableCell>
                <TableCell>
                  <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                    {p.status === 'active' ? 'Ativa' : 'Inativa'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setZonesPanelId(p.id)} title="Zonas">
                      <Radio className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deletePanel.mutate(p.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && panels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Siren className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhuma central cadastrada</p>
          </div>
        )}
      </div>

      {/* Panel dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar Central' : 'Nova Central de Alarme'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Nome da central *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Central Loja Centro" className="bg-muted border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Select value={form.client_id} onValueChange={v => set('client_id', v)}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(clients as any[]).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Fabricante</Label>
              <Select value={form.manufacturer} onValueChange={v => set('manufacturer', v)}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {MANUFACTURERS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Modelo</Label>
              <Input value={form.model} onChange={e => set('model', e.target.value)} placeholder="Ex: AMT 8000 PRO" className="bg-muted border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Número da conta</Label>
              <Input value={form.account_number} onChange={e => set('account_number', e.target.value)} placeholder="Ex: 1234" className="bg-muted border-border font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Partições</Label>
              <Input type="number" min={1} value={form.partitions} onChange={e => set('partitions', e.target.value)} className="bg-muted border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Quantidade de zonas</Label>
              <Input type="number" min={1} value={form.zones_count} onChange={e => set('zones_count', e.target.value)} className="bg-muted border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">IP de comunicação</Label>
              <Input value={form.ip_address} onChange={e => set('ip_address', e.target.value)} placeholder="192.168.1.50" className="bg-muted border-border font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Porta</Label>
              <Input value={form.port} onChange={e => set('port', e.target.value)} placeholder="9009" className="bg-muted border-border font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Telefone de contato</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} className="bg-muted border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Situação</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="bg-muted border-border" rows={2} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={!form.name.trim()} className="w-full">Salvar</Button>
        </DialogContent>
      </Dialog>

      {/* Zones dialog */}
      <Dialog open={!!zonesPanelId} onOpenChange={o => !o && setZonesPanelId(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>Zonas / Setores</DialogTitle></DialogHeader>
          <div className="flex items-end gap-2">
            <div className="w-20">
              <Label className="text-xs text-muted-foreground">Nº</Label>
              <Input type="number" value={newZone.zone_number} onChange={e => setNewZone(p => ({ ...p, zone_number: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input value={newZone.name} onChange={e => setNewZone(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Porta frontal" className="bg-muted border-border" />
            </div>
            <div className="w-36">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={newZone.zone_type} onValueChange={v => setNewZone(p => ({ ...p, zone_type: v }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="perimeter">Perimetral</SelectItem>
                  <SelectItem value="internal">Interna</SelectItem>
                  <SelectItem value="panic">Pânico</SelectItem>
                  <SelectItem value="fire">Incêndio</SelectItem>
                  <SelectItem value="tamper">Sabotagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddZone}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {panelZones.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma zona cadastrada</p>}
            {panelZones.map(z => (
              <div key={z.id} className="flex items-center justify-between bg-muted/40 rounded px-3 py-2">
                <span className="text-sm"><span className="font-mono text-primary mr-2">Z{z.zone_number}</span>{z.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{z.zone_type}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => deleteZone.mutate(z.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlarmPanels;
