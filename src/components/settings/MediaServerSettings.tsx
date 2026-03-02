import { useState } from 'react';
import { Wifi, Server, Plus, Pencil, Trash2, PlayCircle, Loader2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';
import { isLocalInstallation, useLocalTableQuery, useLocalInsertMutation, useLocalUpdateMutation, useLocalPatchMutation, useLocalDeleteMutation } from '@/hooks/useLocalApi';
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
  os: string;
}

const defaultForm = {
  name: 'Servidor MediaMTX',
  ip_address: '',
  instances: 1,
  rtmp_base_port: 1935,
  hls_base_port: 8888,
  webrtc_base_port: 8889,
  status: 'active',
  os: 'linux',
};

const MediaServerSettings = () => {
  const isLocal = isLocalInstallation();

  // Cloud (Supabase) hooks - only enabled when NOT local
  const cloudQuery = useTableQuery('media_servers', 'created_at', { enabled: !isLocal });
  const cloudInsert = useInsertMutation('media_servers');
  const cloudUpdate = useUpdateMutation('media_servers');
  const cloudDelete = useDeleteMutation('media_servers');

  // Local API hooks
  const localQuery = useLocalTableQuery('media_servers');
  const localInsert = useLocalInsertMutation('media_servers');
  const localUpdate = useLocalUpdateMutation('media_servers');
  const localPatch = useLocalPatchMutation('media_servers');
  const localDelete = useLocalDeleteMutation('media_servers');

  // Select the right source based on environment
  const servers = isLocal ? (localQuery.data || []) : (cloudQuery.data || []);
  const isLoading = isLocal ? localQuery.isLoading : cloudQuery.isLoading;
  const insertMutation = isLocal ? localInsert : cloudInsert;
  const updateMutation = isLocal ? localUpdate : cloudUpdate;
  const deleteMutation = isLocal ? localDelete : cloudDelete;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MediaServer | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState<string[]>([]);

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
      os: s.os || 'linux',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingServer(null);
    setForm(defaultForm);
  };

  const handleSave = (andInstall = false) => {
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
        onSuccess: () => {
          if (andInstall) {
            toast.success('Servidor cadastrado! Iniciando instalação do MediaMTX...');
            handleInstallMediaMTX(form.ip_address, form.os);
          } else {
            toast.success('Servidor cadastrado');
            closeDialog();
          }
        },
        onError: (e: any) => toast.error(e.message),
      });
    }
  };

  const handleInstallMediaMTX = async (ip: string, osType: string) => {
    setInstalling(true);
    setInstallLog([]);
    try {
      const apiBase = `http://${ip}:8001`;
      const res = await fetch(`${apiBase}/api/media-servers/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ os: osType }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        toast.error(`Falha na instalação: ${err.error}`);
        setInstalling(false);
        return;
      }

      // Stream SSE response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split('\n').filter(l => l.startsWith('data: '));
          for (const line of lines) {
            try {
              const event = JSON.parse(line.replace('data: ', ''));
              setInstallLog(prev => [...prev, `[${event.status}] ${event.message}`]);
              if (event.step === 'complete') {
                if (event.status === 'success') {
                  toast.success('MediaMTX instalado com sucesso!');
                } else {
                  toast.error(`Instalação falhou: ${event.message}`);
                }
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      toast.error(`Não foi possível conectar ao servidor ${ip}:8001`);
    } finally {
      setInstalling(false);
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => { toast.success('Servidor removido'); setDeleteId(null); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleTest = async (server: MediaServer) => {
    setTestingId(server.id);
    try {
      // Tenta testar via API local do auth-server (porta 8001)
      const testUrl = `http://${server.ip_address}:8001/api/media-servers/test`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip_address: server.ip_address,
          hls_base_port: server.hls_base_port,
          rtmp_base_port: server.rtmp_base_port,
          os: server.os,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const result = await response.json();
        if (result.online) {
          toast.success(`✅ ${server.name} está online! RTMP: ${result.rtmp ? '✓' : '✗'} | HLS: ${result.hls ? '✓' : '✗'}`);
          // Atualizar status para online se estava offline
          if (server.status !== 'online' && server.status !== 'active') {
            if (isLocal) { localPatch.mutate({ id: server.id, status: 'online' }); } else { updateMutation.mutate({ id: server.id, status: 'online' } as any); }
          }
        } else {
          toast.error(`❌ ${server.name}: MediaMTX não respondeu. RTMP: ${result.rtmp ? '✓' : '✗'} | HLS: ${result.hls ? '✓' : '✗'}`);
          if (isLocal) { localPatch.mutate({ id: server.id, status: 'offline' }); } else { updateMutation.mutate({ id: server.id, status: 'offline' } as any); }
        }
      } else {
        toast.error(`❌ ${server.name}: Auth-server não acessível (HTTP ${response.status})`);
        if (isLocal) { localPatch.mutate({ id: server.id, status: 'offline' }); } else { updateMutation.mutate({ id: server.id, status: 'offline' } as any); }
      }
    } catch {
      toast.error(`❌ ${server.name}: Servidor não acessível em ${server.ip_address}:8001`);
      if (isLocal) { localPatch.mutate({ id: server.id, status: 'offline' }); } else { updateMutation.mutate({ id: server.id, status: 'offline' } as any); }
    } finally {
      setTestingId(null);
    }
  };

  const serverList = servers as unknown as MediaServer[];

  const osLabel = (osVal: string) => {
    if (osVal === 'windows') return '🪟 Windows';
    if (osVal === 'linux') return '🐧 Linux';
    return osVal;
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
                Cadastre e teste os servidores MediaMTX. Cada servidor é gerenciado via web.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Novo Servidor
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : serverList.length === 0 ? (
            <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
              <Wifi className="w-8 h-8 mx-auto mb-2 opacity-50 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum servidor cadastrado.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Clique em "Novo Servidor" para cadastrar.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {serverList.map(server => (
                <div key={server.id} className="bg-muted/50 rounded-lg p-3 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Server className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{server.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{server.ip_address}</Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {osLabel(server.os || 'linux')}
                      </Badge>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary"
                        onClick={() => handleTest(server)}
                        disabled={testingId === server.id}
                        title="Testar conexão"
                      >
                        {testingId === server.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PlayCircle className="w-3.5 h-3.5" />
                        )}
                      </Button>
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Instâncias</Label>
                <Input type="number" min={1} max={4} value={form.instances} onChange={e => setForm(f => ({ ...f, instances: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label className="text-xs">Sistema Operacional</Label>
                <Select value={form.os} onValueChange={v => setForm(f => ({ ...f, os: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linux">Linux</SelectItem>
                    <SelectItem value="windows">Windows</SelectItem>
                  </SelectContent>
                </Select>
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
          {/* Install log */}
          {(installing || installLog.length > 0) && (
            <div className="bg-muted/50 border border-border rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
                {installing && <Loader2 className="w-3 h-3 animate-spin" />}
                Log de Instalação
              </p>
              {installLog.map((line, i) => (
                <p key={i} className={`text-[11px] font-mono ${line.includes('[error]') ? 'text-destructive' : line.includes('[success]') ? 'text-emerald-400' : 'text-muted-foreground'}`}>{line}</p>
              ))}
              {installLog.length === 0 && installing && (
                <p className="text-[11px] text-muted-foreground">Aguardando resposta do servidor...</p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            {!editingServer && isLocal && (
              <Button
                variant="secondary"
                onClick={() => handleSave(true)}
                disabled={insertMutation.isPending || updateMutation.isPending || installing}
                className="gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                {installing ? 'Instalando...' : 'Cadastrar e Instalar'}
              </Button>
            )}
            <Button onClick={() => handleSave(false)} disabled={insertMutation.isPending || updateMutation.isPending || installing}>
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
