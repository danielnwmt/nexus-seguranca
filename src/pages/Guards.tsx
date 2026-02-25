import { useState } from 'react';
import { Shield, Plus, Search, Pencil, Trash2, Moon, Sun, Clock } from 'lucide-react';
import { mockGuards, mockClients } from '@/data/mockData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Guard } from '@/types/monitoring';

const shiftConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  day: { label: 'Diurno', icon: Sun, className: 'bg-warning/10 text-warning' },
  night: { label: 'Noturno', icon: Moon, className: 'bg-primary/10 text-primary' },
  '12x36': { label: '12x36', icon: Clock, className: 'bg-accent/10 text-accent' },
};

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-success/10 text-success' },
  inactive: { label: 'Inativo', className: 'bg-destructive/10 text-destructive' },
  on_leave: { label: 'Afastado', className: 'bg-warning/10 text-warning' },
};

const Guards = () => {
  const [guards, setGuards] = useState(mockGuards);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<Guard | null>(null);
  const [form, setForm] = useState({ name: '', cpf: '', phone: '', email: '', shift: 'day', status: 'active', clientIds: [] as string[] });

  const filtered = guards.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.cpf.includes(search)
  );

  const handleSave = () => {
    if (editingGuard) {
      setGuards(prev => prev.map(g => g.id === editingGuard.id ? {
        ...g,
        ...form,
        shift: form.shift as Guard['shift'],
        status: form.status as Guard['status'],
      } : g));
    } else {
      const newGuard: Guard = {
        id: String(guards.length + 1),
        ...form,
        shift: form.shift as Guard['shift'],
        status: form.status as Guard['status'],
        hireDate: new Date().toISOString().split('T')[0],
        schedule: [],
      };
      setGuards(prev => [...prev, newGuard]);
    }
    resetForm();
  };

  const handleEdit = (guard: Guard) => {
    setEditingGuard(guard);
    setForm({
      name: guard.name,
      cpf: guard.cpf,
      phone: guard.phone,
      email: guard.email,
      shift: guard.shift,
      status: guard.status,
      clientIds: guard.clientIds,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setGuards(prev => prev.filter(g => g.id !== id));
  };

  const toggleClient = (clientId: string) => {
    setForm(prev => ({
      ...prev,
      clientIds: prev.clientIds.includes(clientId)
        ? prev.clientIds.filter(id => id !== clientId)
        : [...prev.clientIds, clientId],
    }));
  };

  const resetForm = () => {
    setForm({ name: '', cpf: '', phone: '', email: '', shift: 'day', status: 'active', clientIds: [] });
    setEditingGuard(null);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vigilantes</h1>
          <p className="text-sm text-muted-foreground font-mono">Gestão de vigilantes e escalas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { setEditingGuard(null); resetForm(); }}>
              <Plus className="w-4 h-4" /> Novo Vigilante
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingGuard ? 'Editar Vigilante' : 'Novo Vigilante'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" className="bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CPF</Label>
                  <Input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" className="bg-muted border-border font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(11) 91234-5678" className="bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" className="bg-muted border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Turno</Label>
                  <Select value={form.shift} onValueChange={v => setForm(p => ({ ...p, shift: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Diurno</SelectItem>
                      <SelectItem value="night">Noturno</SelectItem>
                      <SelectItem value="12x36">12x36</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="on_leave">Afastado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Clientes Vinculados</Label>
                <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                  {mockClients.map(client => (
                    <div key={client.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={form.clientIds.includes(client.id)}
                        onCheckedChange={() => toggleClient(client.id)}
                        id={`client-${client.id}`}
                      />
                      <label htmlFor={`client-${client.id}`} className="text-xs text-foreground cursor-pointer">{client.name}</label>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">{editingGuard ? 'Salvar Alterações' : 'Adicionar Vigilante'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar vigilante..." className="pl-9 bg-muted border-border" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Vigilante</th>
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">CPF</th>
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Contato</th>
              <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Turno</th>
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Clientes</th>
              <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(guard => {
              const shift = shiftConfig[guard.shift];
              const ShiftIcon = shift.icon;
              const st = statusLabels[guard.status];
              const linkedClients = mockClients.filter(c => guard.clientIds.includes(c.id));
              return (
                <tr key={guard.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{guard.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">Desde {new Date(guard.hireDate).toLocaleDateString('pt-BR')}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-mono text-foreground">{guard.cpf}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-foreground">{guard.phone}</p>
                    <p className="text-[10px] text-muted-foreground">{guard.email}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full ${shift.className}`}>
                      <ShiftIcon className="w-3 h-3" />
                      {shift.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {linkedClients.map(c => (
                        <span key={c.id} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{c.name.split(' ')[0]}</span>
                      ))}
                      {linkedClients.length === 0 && <span className="text-[10px] text-muted-foreground">Nenhum</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full ${st.className}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleEdit(guard)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(guard.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Shield className="w-12 h-12 mb-3" />
          <p className="text-sm">Nenhum vigilante encontrado</p>
        </div>
      )}
    </div>
  );
};

export default Guards;
