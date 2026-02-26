import { useState } from 'react';
import { Plus, Search, Users, Pencil, Trash2, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';

const maskCpfCnpj = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

const Clients = () => {
  const { toast } = useToast();
  const { data: clients = [], isLoading } = useTableQuery('clients');
  const insertMutation = useInsertMutation('clients');
  const updateMutation = useUpdateMutation('clients');
  const deleteMutation = useDeleteMutation('clients');

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', cpf: '', email: '', phone: '', address: '', monthlyFee: '', paymentDueDay: '', storageServerId: '' });
  const { data: storageServers = [] } = useTableQuery('storage_servers');

  const filtered = clients.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.cpf || '').includes(search)
  );

  const createClientFolder = async (clientName: string, clientId: string) => {
    try {
      const folderName = clientName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const placeholder = new Blob([''], { type: 'text/plain' });
      await supabase.storage.from('client-cameras').upload(`${folderName}-${clientId}/.keep`, placeholder);
    } catch (err) {
      console.error('Erro ao criar pasta do cliente:', err);
    }
  };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      cpf: form.cpf,
      email: form.email,
      phone: form.phone,
      address: form.address,
      monthly_fee: form.monthlyFee ? Number(form.monthlyFee) : null,
      payment_due_day: form.paymentDueDay ? Number(form.paymentDueDay) : null,
      storage_server_id: form.storageServerId || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload } as any);
    } else {
      insertMutation.mutate(payload as any, {
        onSuccess: (data: any) => {
          createClientFolder(form.name, data.id);
          toast({ title: 'Cliente adicionado', description: 'Pasta de imagens criada automaticamente.' });
        },
      });
    }
    resetForm();
  };

  const handleEdit = (client: any) => {
    setEditingId(client.id);
    setForm({
      name: client.name,
      cpf: client.cpf || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      monthlyFee: client.monthly_fee ? String(client.monthly_fee) : '',
      paymentDueDay: client.payment_due_day ? String(client.payment_due_day) : '',
      storageServerId: client.storage_server_id || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const defaultForm = { name: '', cpf: '', email: '', phone: '', address: '', monthlyFee: '', paymentDueDay: '', storageServerId: '' };
  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground font-mono">Gestão de clientes monitorados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { setEditingId(null); setForm(defaultForm); }}>
              <Plus className="w-4 h-4" /> Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingId ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do cliente" className="bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CPF / CNPJ</Label>
                  <Input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: maskCpfCnpj(e.target.value) }))} placeholder="000.000.000-00" className="bg-muted border-border font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" className="bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: maskPhone(e.target.value) }))} placeholder="(11) 99999-9999" className="bg-muted border-border font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Endereço</Label>
                <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Rua, número - Cidade" className="bg-muted border-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Mensalidade (R$)</Label>
                  <Input type="number" value={form.monthlyFee} onChange={e => setForm(p => ({ ...p, monthlyFee: e.target.value }))} placeholder="1500.00" className="bg-muted border-border font-mono" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Dia Vencimento</Label>
                  <Input type="number" min="1" max="31" value={form.paymentDueDay} onChange={e => setForm(p => ({ ...p, paymentDueDay: e.target.value }))} placeholder="10" className="bg-muted border-border font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Servidor de Gravação</Label>
                <Select value={form.storageServerId} onValueChange={v => setForm(p => ({ ...p, storageServerId: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione o servidor" /></SelectTrigger>
                  <SelectContent>
                    {storageServers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.ip_address})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full">{editingId ? 'Salvar Alterações' : 'Adicionar Cliente'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-9 bg-muted border-border" />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Cliente</th>
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">CPF/CNPJ</th>
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Contato</th>
              <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Câmeras</th>
              <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client: any) => (
              <tr key={client.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{client.name}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs font-mono text-foreground">{client.cpf}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-foreground">{client.email}</p>
                  <p className="text-[10px] text-muted-foreground">{client.phone}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-foreground">
                    <Camera className="w-3 h-3 text-primary" />
                    {client.cameras_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    client.status === 'active' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    <div className={`status-dot ${client.status === 'active' ? 'status-online' : 'status-offline'}`} />
                    {client.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleEdit(client)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(client.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mb-3" />
          <p className="text-sm">Nenhum cliente encontrado</p>
        </div>
      )}
    </div>
  );
};

export default Clients;
