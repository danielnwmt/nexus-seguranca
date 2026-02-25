import { useState } from 'react';
import { Plus, Search, Users, Pencil, Trash2, Camera, HardDrive, Calendar } from 'lucide-react';
import { mockClients } from '@/data/mockData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Client } from '@/types/monitoring';

const RETENTION_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

const Clients = () => {
  const [clients, setClients] = useState(mockClients);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: '', cpf: '', email: '', phone: '', address: '', storagePath: '', retentionDays: '30' });

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf.includes(search)
  );

  const handleSave = () => {
    if (editingClient) {
      setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...form, retentionDays: Number(form.retentionDays) as Client['retentionDays'] } : c));
    } else {
      const newClient: Client = {
        id: String(clients.length + 1),
        ...form,
        retentionDays: Number(form.retentionDays) as Client['retentionDays'],
        camerasCount: 0,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
      };
      setClients(prev => [...prev, newClient]);
    }
    resetForm();
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setForm({ name: client.name, cpf: client.cpf, email: client.email, phone: client.phone, address: client.address, storagePath: client.storagePath, retentionDays: String(client.retentionDays) });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  };

  const resetForm = () => {
    setForm({ name: '', cpf: '', email: '', phone: '', address: '', storagePath: '', retentionDays: '30' });
    setEditingClient(null);
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
            <Button className="gap-2" onClick={() => { setEditingClient(null); setForm({ name: '', cpf: '', email: '', phone: '', address: '', storagePath: '', retentionDays: '30' }); }}>
              <Plus className="w-4 h-4" /> Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do cliente" className="bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CPF / CNPJ</Label>
                  <Input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" className="bg-muted border-border font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" className="bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(11) 9999-9999" className="bg-muted border-border" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Endereço</Label>
                <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Rua, número - Cidade" className="bg-muted border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><HardDrive className="w-3 h-3" /> Caminho de Gravação</Label>
                <Input value={form.storagePath} onChange={e => setForm(p => ({ ...p, storagePath: e.target.value }))} placeholder="D:\Gravacoes\Cliente" className="bg-muted border-border font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Dias de Retenção</Label>
                <Select value={form.retentionDays} onValueChange={v => setForm(p => ({ ...p, retentionDays: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {RETENTION_OPTIONS.map(d => (
                      <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full">{editingClient ? 'Salvar Alterações' : 'Adicionar Cliente'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-9 bg-muted border-border" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Cliente</th>
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">CPF/CNPJ</th>
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Contato</th>
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Gravação</th>
              <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Câmeras</th>
              <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(client => (
              <tr key={client.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{client.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">ID: {client.id}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs font-mono text-foreground">{client.cpf}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-foreground">{client.email}</p>
                  <p className="text-[10px] text-muted-foreground">{client.phone}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-[10px] font-mono text-foreground truncate max-w-[180px]" title={client.storagePath}>{client.storagePath}</p>
                  <p className="text-[10px] text-muted-foreground">{client.retentionDays} dias de retenção</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-foreground">
                    <Camera className="w-3 h-3 text-primary" />
                    {client.camerasCount}
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

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mb-3" />
          <p className="text-sm">Nenhum cliente encontrado</p>
        </div>
      )}
    </div>
  );
};

export default Clients;
