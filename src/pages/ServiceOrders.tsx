import { useState } from 'react';
import { ClipboardList, Plus, Edit, Trash2, Search, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';

interface ServiceOrder {
  id: string;
  order_number: string;
  client_id: string | null;
  client_name: string | null;
  installer_id: string | null;
  installer_name: string | null;
  type: string;
  description: string | null;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  notes: string | null;
  created_at: string;
}

interface Client { id: string; name: string; }
interface Installer { id: string; name: string; }

const typeLabels: Record<string, string> = {
  installation: 'Instalação',
  maintenance: 'Manutenção',
  removal: 'Remoção',
  inspection: 'Vistoria',
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  scheduled: { label: 'Agendada', variant: 'outline' },
  in_progress: { label: 'Em Andamento', variant: 'default' },
  completed: { label: 'Concluída', variant: 'secondary' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
};

const ServiceOrders = () => {
  const { toast } = useToast();
  const { data: orders = [], isLoading } = useTableQuery<ServiceOrder>('service_orders' as any, 'created_at', false);
  const { data: clients = [] } = useTableQuery<Client>('clients', 'name', true);
  const { data: installers = [] } = useTableQuery<Installer>('installers' as any, 'name', true);
  const insertMutation = useInsertMutation('service_orders' as any);
  const updateMutation = useUpdateMutation('service_orders' as any);
  const deleteMutation = useDeleteMutation('service_orders' as any);

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceOrder | null>(null);
  const [form, setForm] = useState({
    client_id: '', client_name: '', installer_id: '', installer_name: '',
    type: 'installation', description: '', status: 'pending', scheduled_date: '', notes: '',
  });

  const filtered = orders.filter(o =>
    (o.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
    o.order_number.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ client_id: '', client_name: '', installer_id: '', installer_name: '', type: 'installation', description: '', status: 'pending', scheduled_date: '', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (o: ServiceOrder) => {
    setEditing(o);
    setForm({
      client_id: o.client_id || '', client_name: o.client_name || '',
      installer_id: o.installer_id || '', installer_name: o.installer_name || '',
      type: o.type, description: o.description || '', status: o.status,
      scheduled_date: o.scheduled_date || '', notes: o.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.client_id) { toast({ title: 'Selecione um cliente', variant: 'destructive' }); return; }
    const payload = {
      ...form,
      client_id: form.client_id || null,
      installer_id: form.installer_id || null,
      scheduled_date: form.scheduled_date || null,
      completed_date: form.status === 'completed' ? new Date().toISOString().split('T')[0] : null,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
        toast({ title: 'OS atualizada' });
      } else {
        await insertMutation.mutateAsync(payload);
        toast({ title: 'OS criada com sucesso' });
      }
      setDialogOpen(false);
    } catch { toast({ title: 'Erro ao salvar', variant: 'destructive' }); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'OS removida', variant: 'destructive' });
    } catch { toast({ title: 'Erro ao remover', variant: 'destructive' }); }
  };

  const handlePrint = (o: ServiceOrder) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>OS ${o.order_number}</title>
      <style>body{font-family:sans-serif;padding:40px;color:#333}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:8px 12px;border:1px solid #ddd}td:first-child{font-weight:bold;width:180px;background:#f5f5f5}</style></head>
      <body><h1>Ordem de Serviço — ${o.order_number}</h1>
      <table>
        <tr><td>Cliente</td><td>${o.client_name || '—'}</td></tr>
        <tr><td>Técnico</td><td>${o.installer_name || '—'}</td></tr>
        <tr><td>Tipo</td><td>${typeLabels[o.type] || o.type}</td></tr>
        <tr><td>Status</td><td>${statusConfig[o.status]?.label || o.status}</td></tr>
        <tr><td>Data Agendada</td><td>${o.scheduled_date || '—'}</td></tr>
        <tr><td>Descrição</td><td>${o.description || '—'}</td></tr>
        <tr><td>Observações</td><td>${o.notes || '—'}</td></tr>
      </table>
      <p style="margin-top:40px;font-size:12px;color:#999">Emitido em ${new Date().toLocaleString('pt-BR')}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const selectClient = (id: string) => {
    const c = clients.find(c => c.id === id);
    setForm(p => ({ ...p, client_id: id, client_name: c?.name || '' }));
  };

  const selectInstaller = (id: string) => {
    const i = installers.find(i => i.id === id);
    setForm(p => ({ ...p, installer_id: id, installer_name: i?.name || '' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground font-mono">Emissão e gestão de OS para clientes</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar OS ou cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-card border-border" />
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Nova OS</Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">Ordens de Serviço</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº OS</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Agendada</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(o => {
                  const sc = statusConfig[o.status] || { label: o.status, variant: 'secondary' as const };
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-sm font-medium">{o.order_number}</TableCell>
                      <TableCell>{o.client_name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{o.installer_name || '—'}</TableCell>
                      <TableCell><Badge variant="secondary">{typeLabels[o.type] || o.type}</Badge></TableCell>
                      <TableCell><Badge variant={sc.variant}>{sc.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{o.scheduled_date || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrint(o)}><Printer className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(o)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(o.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma OS encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar OS' : 'Nova Ordem de Serviço'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Cliente *</Label>
              <Select value={form.client_id} onValueChange={selectClient}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Técnico</Label>
              <Select value={form.installer_id} onValueChange={selectInstaller}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione o técnico" /></SelectTrigger>
                <SelectContent>{installers.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="installation">Instalação</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                    <SelectItem value="removal">Remoção</SelectItem>
                    <SelectItem value="inspection">Vistoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="scheduled">Agendada</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Agendada</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição do Serviço</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-muted border-border" rows={3} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="bg-muted border-border" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceOrders;
