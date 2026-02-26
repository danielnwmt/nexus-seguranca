import { useState } from 'react';
import { HardDrive, Plus, Pencil, Trash2, Save, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';

interface ServerForm {
  name: string;
  ip_address: string;
  storage_path: string;
  description: string;
  max_storage_gb: string;
  status: string;
}

const emptyForm: ServerForm = { name: '', ip_address: '', storage_path: '', description: '', max_storage_gb: '1000', status: 'active' };

const StorageServers = () => {
  const { toast } = useToast();
  const { data: servers = [], isLoading } = useTableQuery('storage_servers');
  const insertMutation = useInsertMutation('storage_servers');
  const updateMutation = useUpdateMutation('storage_servers');
  const deleteMutation = useDeleteMutation('storage_servers');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServerForm>({ ...emptyForm });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleSave = () => {
    if (!form.name || !form.ip_address) {
      toast({ title: 'Preencha nome e IP do servidor', variant: 'destructive' });
      return;
    }
    const payload = {
      name: form.name,
      ip_address: form.ip_address,
      storage_path: form.storage_path,
      description: form.description,
      max_storage_gb: Number(form.max_storage_gb) || 1000,
      status: form.status,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload } as any);
    } else {
      insertMutation.mutate(payload as any);
    }
    resetForm();
    toast({ title: editingId ? 'Servidor atualizado' : 'Servidor adicionado' });
  };

  const handleEdit = (server: any) => {
    setEditingId(server.id);
    setForm({
      name: server.name || '',
      ip_address: server.ip_address || '',
      storage_path: server.storage_path || '',
      description: server.description || '',
      max_storage_gb: String(server.max_storage_gb || 1000),
      status: server.status || 'active',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
    toast({ title: 'Servidor removido', variant: 'destructive' });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            Servidores de Gravação
          </CardTitle>
          <CardDescription className="text-xs">Configure os servidores onde as imagens serão armazenadas</CardDescription>
        </div>
        <Button size="sm" className="gap-1" onClick={() => { setEditingId(null); setForm({ ...emptyForm }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4" /> Novo Servidor
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>IP / Host</TableHead>
              <TableHead>Caminho</TableHead>
              <TableHead>Capacidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(servers as any[]).map((server: any) => (
              <TableRow key={server.id}>
                <TableCell className="font-medium">{server.name}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{server.ip_address}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{server.storage_path}</TableCell>
                <TableCell className="text-sm">{server.max_storage_gb} GB</TableCell>
                <TableCell>
                  <Badge variant={server.status === 'active' ? 'default' : 'secondary'}>
                    {server.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(server)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(server.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && servers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Nenhum servidor cadastrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); else setDialogOpen(true); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Servidor' : 'Novo Servidor de Gravação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome do Servidor</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Servidor Principal" className="bg-muted border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">IP / Hostname</Label>
                <Input value={form.ip_address} onChange={e => setForm(p => ({ ...p, ip_address: e.target.value }))} placeholder="192.168.1.100" className="bg-muted border-border font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Capacidade (GB)</Label>
                <Input type="number" value={form.max_storage_gb} onChange={e => setForm(p => ({ ...p, max_storage_gb: e.target.value }))} placeholder="1000" className="bg-muted border-border font-mono" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Caminho de Gravação</Label>
              <Input value={form.storage_path} onChange={e => setForm(p => ({ ...p, storage_path: e.target.value }))} placeholder="D:\Gravacoes" className="bg-muted border-border font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Servidor de gravação principal" className="bg-muted border-border" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.status === 'active'} onCheckedChange={v => setForm(p => ({ ...p, status: v ? 'active' : 'inactive' }))} />
              <Label className="text-xs">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default StorageServers;
