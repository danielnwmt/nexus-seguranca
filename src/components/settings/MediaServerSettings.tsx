import { useState } from 'react';
import { Wifi, Server, Plus, Pencil, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';
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

const MediaServerSettings = () => {
  const { data: company } = useCompanySettings();
  const { data: servers = [], isLoading } = useTableQuery('media_servers');
  const insertMutation = useInsertMutation('media_servers');
  const updateMutation = useUpdateMutation('media_servers');
  const deleteMutation = useDeleteMutation('media_servers');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MediaServer | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncWarning(null);
    try {
      const serverIp = company?.media_server_ip || window.location.hostname;
      const syncUrl = `http://${serverIp}:8001/api/sync/media-servers`;
      const res = await fetch(syncUrl, { method: 'POST', signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('Servidor local indisponível');
      const data = await res.json();
      if (data.error) {
        setSyncWarning(data.error);
      } else {
        toast.success(`${data.synced} servidor(es) sincronizado(s)`);
      }
    } catch {
      setSyncWarning('Não foi possível conectar ao servidor local (porta 8001). A sincronização só funciona quando o sistema está instalado no servidor. Você pode cadastrar servidores manualmente.');
    } finally {
      setSyncing(false);
    }
  };

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
    if (editingServer) {
      updateMutation.mutate({ id: editingServer.id, ...form } as any, {
        onSuccess: () => { toast.success('Servidor atualizado'); closeDialog(); },
        onError: (e: any) => toast.error(e.message),
      });
    } else {
      insertMutation.mutate(form as any, {
        onSuccess: () => { toast.success('Servidor cadastrado'); closeDialog(); },
        onError: (e: any) => toast.error(e.message),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => { toast.success('Servidor removido'); setDeleteId(null); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const serverList = servers as unknown as MediaServer[];

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
              <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
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
          {/* Sync warning */}
          {syncWarning && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">{syncWarning}</p>
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : serverList.length === 0 ? (
            <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
              <Wifi className="w-8 h-8 mx-auto mb-2 opacity-50 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum servidor cadastrado.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Clique em "Novo Servidor" para cadastrar manualmente ou instale o sistema para registro automático.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {serverList.map(server => (
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
            <Button onClick={handleSave} disabled={insertMutation.isPending || updateMutation.isPending}>
              {(insertMutation.isPending || updateMutation.isPending) ? 'Salvando...' : editingServer ? 'Salvar' : 'Cadastrar'}
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
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MediaServerSettings;
