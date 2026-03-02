import { useState } from 'react';
import { Wifi, Server, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { toast } from 'sonner';

interface MediaServer {
  id: string;
  name: string;
  ip_address: string;
  instances: number;
  rtmp_base_port: number;
  hls_base_port: number;
  webrtc_base_port: number;
  status: string;
}

const defaultForm = {
  name: 'Servidor MediaMTX',
  ip_address: '',
  instances: 1,
  rtmp_base_port: 1935,
  hls_base_port: 8888,
  webrtc_base_port: 8889,
  status: 'active',
};

// Helper: resolve base URL do auth-server local
function getLocalApiBase() {
  const { hostname } = window.location;
  return `http://${hostname}:8001`;
}

const MediaServerSettings = () => {
  const qc = useQueryClient();
  const { data: company } = useCompanySettings();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MediaServer | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const apiBase = getLocalApiBase();

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['media_servers'],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/media-servers`);
      if (!res.ok) throw new Error('Não foi possível conectar ao servidor local');
      return res.json() as Promise<MediaServer[]>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof defaultForm & { id?: string }) => {
      const url = values.id
        ? `${apiBase}/api/media-servers/${values.id}`
        : `${apiBase}/api/media-servers`;
      const method = values.id ? 'PUT' : 'POST';
      const { id, ...body } = values as any;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar servidor');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media_servers'] });
      toast.success(editingServer ? 'Servidor atualizado' : 'Servidor cadastrado');
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiBase}/api/media-servers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao remover servidor');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media_servers'] });
      toast.success('Servidor removido');
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const serverIp = company?.media_server_ip || window.location.hostname;
      const syncUrl = `http://${serverIp}:8001/api/sync/media-servers`;
      const res = await fetch(syncUrl, { method: 'POST' });
      if (!res.ok) throw new Error('Não foi possível conectar ao servidor local');
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['media_servers'] });
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`${data.synced} servidor(es) sincronizado(s)`);
      }
    },
    onError: (e: any) => toast.error('Erro ao sincronizar: ' + e.message),
  });

  const openCreate = () => {
    setEditingServer(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (s: MediaServer) => {
    setEditingServer(s);
    setForm({
      name: s.name,
      ip_address: s.ip_address,
      instances: s.instances,
      rtmp_base_port: s.rtmp_base_port,
      hls_base_port: s.hls_base_port,
      webrtc_base_port: s.webrtc_base_port,
      status: s.status,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingServer(null);
    setForm(defaultForm);
  };

  const handleSave = () => {
    if (!form.ip_address.trim()) {
      toast.error('Informe o endereço IP');
      return;
    }
    saveMutation.mutate(editingServer ? { ...form, id: editingServer.id } : form);
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="w-4 h-4 text-primary" />
                Servidores de Mídia
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Gerencie os servidores MediaMTX para streaming das câmeras.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                Sincronizar
              </Button>
              <Button size="sm" onClick={openCreate} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Novo Servidor
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : servers.length === 0 ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-xs text-destructive">
                ⚠️ Nenhum servidor cadastrado. Clique em "Novo Servidor" ou instale o sistema para registro automático.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {servers.map(server => (
                <div key={server.id} className="bg-muted/50 rounded-lg p-3 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{server.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{server.ip_address}</Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {server.instances} instância{server.instances > 1 ? 's' : ''}
                      </Badge>
                      <Badge className={`text-[10px] ${
                        server.status === 'online' || server.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-destructive/20 text-destructive border-destructive/30'
                      }`}>
                        {server.status === 'online' || server.status === 'active' ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(server)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(server.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    {Array.from({ length: server.instances }, (_, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <Badge variant="secondary" className="text-[9px] w-12 justify-center">#{i + 1}</Badge>
                        <div className="flex items-center gap-3 font-mono text-muted-foreground">
                          <span>RTMP:{server.rtmp_base_port + i}</span>
                          <span>•</span>
                          <span>HLS:{server.hls_base_port + i}</span>
                          <span>•</span>
                          <span>WebRTC:{server.webrtc_base_port + i}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingServer ? 'Editar Servidor' : 'Novo Servidor de Mídia'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Servidor MediaMTX" />
            </div>
            <div>
              <Label className="text-xs">Endereço IP</Label>
              <Input value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} placeholder="192.168.1.100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Instâncias</Label>
                <Input type="number" min={1} max={4} value={form.instances} onChange={e => setForm(f => ({ ...f, instances: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Porta RTMP</Label>
                <Input type="number" value={form.rtmp_base_port} onChange={e => setForm(f => ({ ...f, rtmp_base_port: parseInt(e.target.value) || 1935 }))} />
              </div>
              <div>
                <Label className="text-xs">Porta HLS</Label>
                <Input type="number" value={form.hls_base_port} onChange={e => setForm(f => ({ ...f, hls_base_port: parseInt(e.target.value) || 8888 }))} />
              </div>
              <div>
                <Label className="text-xs">Porta WebRTC</Label>
                <Input type="number" value={form.webrtc_base_port} onChange={e => setForm(f => ({ ...f, webrtc_base_port: parseInt(e.target.value) || 8889 }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : editingServer ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover servidor?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MediaServerSettings;
