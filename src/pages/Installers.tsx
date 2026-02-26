import { useState } from 'react';
import { Wrench, Plus, Edit, Trash2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';

interface Installer {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  specialty: string;
  status: string;
  created_at: string;
}

const specialtyLabels: Record<string, string> = {
  cameras: 'Câmeras',
  alarm: 'Alarmes',
  network: 'Rede',
  general: 'Geral',
};

const Installers = () => {
  const { toast } = useToast();
  const { data: installers = [], isLoading } = useTableQuery<Installer>('installers' as any, 'created_at', false);
  const insertMutation = useInsertMutation('installers' as any);
  const updateMutation = useUpdateMutation('installers' as any);
  const deleteMutation = useDeleteMutation('installers' as any);

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Installer | null>(null);
  const [form, setForm] = useState({ name: '', cpf: '', phone: '', email: '', specialty: 'cameras', status: 'active' });

  const filtered = installers.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', cpf: '', phone: '', email: '', specialty: 'cameras', status: 'active' });
    setDialogOpen(true);
  };

  const openEdit = (inst: Installer) => {
    setEditing(inst);
    setForm({ name: inst.name, cpf: inst.cpf || '', phone: inst.phone || '', email: inst.email || '', specialty: inst.specialty, status: inst.status });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast({ title: 'Nome é obrigatório', variant: 'destructive' }); return; }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form });
        toast({ title: 'Instalador atualizado' });
      } else {
        await insertMutation.mutateAsync(form);
        toast({ title: 'Instalador cadastrado' });
      }
      setDialogOpen(false);
    } catch { toast({ title: 'Erro ao salvar', variant: 'destructive' }); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Instalador removido', variant: 'destructive' });
    } catch { toast({ title: 'Erro ao remover', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wrench className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Instaladores</h1>
          <p className="text-sm text-muted-foreground font-mono">Cadastro e gestão da equipe técnica</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar instalador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-card border-border" />
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Novo Instalador</Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">Equipe Técnica</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(inst => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">{inst.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">{inst.cpf || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inst.phone || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inst.email || '—'}</TableCell>
                    <TableCell><Badge variant="secondary">{specialtyLabels[inst.specialty] || inst.specialty}</Badge></TableCell>
                    <TableCell>
                      <span className={`text-xs font-mono ${inst.status === 'active' ? 'text-success' : 'text-destructive'}`}>
                        {inst.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(inst)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(inst.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum instalador cadastrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{editing ? 'Editar Instalador' : 'Novo Instalador'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-muted border-border" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} className="bg-muted border-border" placeholder="000.000.000-00" /></div>
              <div className="space-y-1"><Label className="text-xs">Telefone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="bg-muted border-border" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="bg-muted border-border" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Especialidade</Label>
                <Select value={form.specialty} onValueChange={v => setForm(p => ({ ...p, specialty: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cameras">Câmeras</SelectItem>
                    <SelectItem value="alarm">Alarmes</SelectItem>
                    <SelectItem value="network">Rede</SelectItem>
                    <SelectItem value="general">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

export default Installers;
