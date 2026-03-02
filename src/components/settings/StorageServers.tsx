import { useState } from 'react';
import { HardDrive, Plus, Pencil, Trash2, Save, Server, Monitor, Globe, Loader2 } from 'lucide-react';
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
import { isLocalInstallation, useLocalTableQuery, useLocalInsertMutation, useLocalUpdateMutation, useLocalDeleteMutation } from '@/hooks/useLocalApi';
import { toast as sonnerToast } from 'sonner';

interface ServerForm {
  name: string;
  ip_address: string;
  storage_path: string;
  description: string;
  max_storage_gb: string;
  status: string;
  is_local: boolean;
}

interface SystemInfo {
  platform: string;
  os_name: string;
  hostname: string;
  local_ip: string;
  suggested_path: string;
  disk_free_gb: number;
  total_memory_gb: number;
}

const emptyForm: ServerForm = {
  name: '',
  ip_address: '',
  storage_path: '',
  description: '',
  max_storage_gb: '1000',
  status: 'active',
  is_local: true,
};

function getLocalApiBase() {
  return `http://${window.location.hostname}:8001`;
}

const StorageServers = () => {
  const { toast } = useToast();
  const isLocal = isLocalInstallation();

  // Cloud hooks
  const cloudQuery = useTableQuery('storage_servers', 'created_at', { enabled: !isLocal });
  const cloudInsert = useInsertMutation('storage_servers');
  const cloudUpdate = useUpdateMutation('storage_servers');
  const cloudDelete = useDeleteMutation('storage_servers');

  // Local API hooks
  const localQuery = useLocalTableQuery('storage_servers');
  const localInsert = useLocalInsertMutation('storage_servers');
  const localUpdate = useLocalUpdateMutation('storage_servers');
  const localDelete = useLocalDeleteMutation('storage_servers');

  // Select the right source
  const servers = isLocal ? (localQuery.data || []) : (cloudQuery.data || []);
  const isLoading = isLocal ? localQuery.isLoading : cloudQuery.isLoading;
  const insertMutation = isLocal ? localInsert : cloudInsert;
  const updateMutation = isLocal ? localUpdate : cloudUpdate;
  const deleteMutation = isLocal ? localDelete : cloudDelete;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServerForm>({ ...emptyForm });
  const [detecting, setDetecting] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [creatingPath, setCreatingPath] = useState(false);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setDialogOpen(false);
    setSystemInfo(null);
  };

  const detectSystem = async () => {
    setDetecting(true);
    try {
      const res = await fetch(`${getLocalApiBase()}/api/system-info`);
      if (!res.ok) throw new Error('Falha na detecção');
      const info: SystemInfo = await res.json();
      setSystemInfo(info);
      setForm(prev => ({
        ...prev,
        name: prev.name || `Servidor Local (${info.os_name})`,
        ip_address: info.local_ip,
        storage_path: info.suggested_path,
        max_storage_gb: String(info.disk_free_gb > 0 ? info.disk_free_gb : 1000),
        description: `${info.os_name} - ${info.hostname}`,
      }));
      sonnerToast.success(`${info.os_name} detectado • IP: ${info.local_ip} • ${info.disk_free_gb} GB livres`);
    } catch {
      sonnerToast.error('Não foi possível conectar ao servidor local (porta 8001)');
    } finally {
      setDetecting(false);
    }
  };

  const createStoragePath = async () => {
    if (!form.storage_path) return;
    setCreatingPath(true);
    try {
      const res = await fetch(`${getLocalApiBase()}/api/storage/create-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: form.storage_path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      sonnerToast.success(`Pasta criada: ${form.storage_path}`);
    } catch (e: any) {
      sonnerToast.error(e.message);
    } finally {
      setCreatingPath(false);
    }
  };

  const handleLocalToggle = (isLocal: boolean) => {
    setForm(prev => ({ ...prev, is_local: isLocal }));
    if (isLocal) {
      detectSystem();
    } else {
      setSystemInfo(null);
      setForm(prev => ({
        ...prev,
        name: '',
        ip_address: '',
        storage_path: '',
        description: '',
        max_storage_gb: '1000',
      }));
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.ip_address) {
      toast({ title: 'Preencha nome e IP do servidor', variant: 'destructive' });
      return;
    }

    // Se local, criar a pasta automaticamente
    if (form.is_local && form.storage_path) {
      try {
        await fetch(`${getLocalApiBase()}/api/storage/create-path`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storage_path: form.storage_path }),
        });
      } catch {
        // Ignorar erro - pode já existir
      }
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
      is_local: false,
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
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Servidor' : 'Novo Servidor de Gravação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Toggle Local / Remoto */}
            {!editingId && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.is_local ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => handleLocalToggle(true)}
                >
                  <Monitor className="w-4 h-4" />
                  Servidor Local
                </Button>
                <Button
                  type="button"
                  variant={!form.is_local ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => handleLocalToggle(false)}
                >
                  <Globe className="w-4 h-4" />
                  Servidor Remoto
                </Button>
              </div>
            )}

            {/* Sistema detectado */}
            {detecting && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/50 rounded-md">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Detectando sistema operacional...
              </div>
            )}

            {systemInfo && !detecting && (
              <div className="flex items-center gap-2 text-xs p-2 bg-primary/10 border border-primary/20 rounded-md text-primary">
                <Monitor className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>{systemInfo.os_name}</strong> detectado • {systemInfo.hostname} • {systemInfo.disk_free_gb} GB livres
                </span>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome do Servidor</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Servidor Principal" className="bg-muted border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">IP / Hostname</Label>
                <Input
                  value={form.ip_address}
                  onChange={e => setForm(p => ({ ...p, ip_address: e.target.value }))}
                  placeholder="192.168.1.100"
                  className="bg-muted border-border font-mono"
                  readOnly={form.is_local && !!systemInfo}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Capacidade (GB)</Label>
                <Input type="number" value={form.max_storage_gb} onChange={e => setForm(p => ({ ...p, max_storage_gb: e.target.value }))} placeholder="1000" className="bg-muted border-border font-mono" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Caminho de Gravação</Label>
              <div className="flex gap-2">
                <Input
                  value={form.storage_path}
                  onChange={e => setForm(p => ({ ...p, storage_path: e.target.value }))}
                  placeholder={systemInfo?.platform === 'win32' ? 'D:\\Gravacoes' : '/opt/nexus-monitoramento/gravacoes'}
                  className="bg-muted border-border font-mono flex-1"
                />
                {form.is_local && form.storage_path && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={createStoragePath}
                    disabled={creatingPath}
                    className="shrink-0 text-xs"
                  >
                    {creatingPath ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Criar Pasta'}
                  </Button>
                )}
              </div>
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
