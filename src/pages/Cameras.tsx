import { useState } from 'react';
import { Camera, Plus, Search, HardDrive, Calendar, Brain, Video, Key, Copy } from 'lucide-react';
import CameraFeed from '@/components/dashboard/CameraFeed';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { AnalyticType } from '@/types/monitoring';
import { ANALYTIC_LABELS } from '@/types/monitoring';
import { useTableQuery, usePaginatedQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';

const RETENTION_OPTIONS = [0, 5, 10, 15, 20, 25, 30] as const;
const ALL_ANALYTICS: AnalyticType[] = ['lpr', 'weapon_detection', 'line_crossing', 'area_intrusion', 'loitering', 'human_car_classification', 'fallen_person', 'people_counting', 'tampering'];
const VIDEO_ENCODINGS = ['H.264', 'H.264+', 'H.265'] as const;
const BITRATE_OPTIONS = [256, 512, 1024, 2048, 3072, 4096, 6144, 8192] as const;
const RESOLUTION_OPTIONS = ['640x480', '1280x720', '1920x1080', '2560x1440', '3840x2160'] as const;
const CAMERA_BRANDS = ['Hikvision', 'Dahua', 'Intelbras', 'Axis', 'Bosch', 'Samsung', 'Vivotek', 'Giga', 'Motorola', 'TP-Link', 'Outro'] as const;

interface CameraForm {
  name: string;
  streamUrl: string;
  protocol: 'RTSP' | 'RTMP';
  location: string;
  resolution: string;
  clientId: string;
  storagePath: string;
  retentionDays: string;
  analytics: AnalyticType[];
  videoEncoding: string;
  maxBitrate: string;
  brand: string;
}

// stream_key is auto-generated as UUID by the database (gen_random_uuid())

const emptyForm: CameraForm = { name: '', streamUrl: '', protocol: 'RTSP', location: '', resolution: '1920x1080', clientId: '', storagePath: '', retentionDays: '30', analytics: [], videoEncoding: 'H.264', maxBitrate: '4096', brand: '' };

const Cameras = () => {
  const { toast } = useToast();
  const { data: clients = [] } = useTableQuery('clients');
  const { data: mediaServers = [] } = useTableQuery('media_servers');
  const { data: storageServers = [] } = useTableQuery('storage_servers');
  const serverList = mediaServers as any[];
  const firstServer = serverList.length > 0 ? serverList[0] : null;
  const defaultMediaServerIp = firstServer?.ip_address || '';
  const hlsPort = firstServer?.hls_base_port || 8888;
  const webrtcPort = firstServer?.webrtc_base_port || 8889;
  const rtmpPort = firstServer?.rtmp_base_port || 1935;

  // Resolve media server IP from client's storage_server_id
  const getServerIpForClient = (clientId: string): string => {
    if (!clientId) return defaultMediaServerIp;
    const client = (clients as any[]).find((c: any) => c.id === clientId);
    if (!client?.storage_server_id) return defaultMediaServerIp;
    const storageServer = (storageServers as any[]).find((s: any) => s.id === client.storage_server_id);
    return storageServer?.ip_address || defaultMediaServerIp;
  };
  const insertMutation = useInsertMutation('cameras');
  const updateMutation = useUpdateMutation('cameras');
  const deleteMutation = useDeleteMutation('cameras');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProtocol, setFilterProtocol] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCamera, setNewCamera] = useState<CameraForm>({ ...emptyForm });
  const [editingStreamKey, setEditingStreamKey] = useState<string>('');
  const [newStreamKey, setNewStreamKey] = useState<string>(''); // key for new cameras, generated once
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const filters: Record<string, string> = {};
  if (filterStatus !== 'all') filters.status = filterStatus;
  if (filterProtocol !== 'all') filters.protocol = filterProtocol;

  const { data: result, isLoading } = usePaginatedQuery('cameras', page, PAGE_SIZE, {
    search: search || undefined,
    searchColumns: ['name', 'location'],
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  const cameras = result?.data || [];
  const totalPages = result?.totalPages || 0;
  const totalCount = result?.count || 0;

  const resetForm = () => {
    setNewCamera({ ...emptyForm });
    setEditingId(null);
    setEditingStreamKey('');
    setNewStreamKey('');
    setDialogOpen(false);
  };

  // Get the current active stream key (editing or new)
  const currentStreamKey = editingId ? editingStreamKey : newStreamKey;

  const buildStreamUrl = (protocol: string, serverIp: string, key: string) => {
    if (!serverIp || !key) return '';
    if (protocol === 'RTMP') return `rtmp://${serverIp}:${rtmpPort}/${key}`;
    return `rtsp://${serverIp}:8554/${key}`;
  };

  const generateStreamKey = () => {
    // Gera uma chave com 12 dígitos aleatórios
    return Math.random().toString(36).substring(2, 14).padEnd(12, '0').substring(0, 12);
  };

  const handleAddCameraClick = () => {
    try {
      if (serverList.length === 0) {
        toast({ title: 'Servidor de mídia obrigatório', description: 'Cadastre pelo menos um servidor de mídia em Configurações → Servidores antes de adicionar câmeras.', variant: 'destructive' });
        return;
      }

      const generatedKey = generateStreamKey();
      const initialUrl = buildStreamUrl(emptyForm.protocol, defaultMediaServerIp, generatedKey);

      setEditingId(null);
      setEditingStreamKey('');
      setNewStreamKey(generatedKey);
      setNewCamera({ ...emptyForm, streamUrl: initialUrl });
      setDialogOpen(true);
    } catch (error) {
      console.error('Erro ao abrir modal de câmera:', error);
      toast({ title: 'Erro ao abrir formulário', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  const toggleAnalytic = (analytic: AnalyticType) => {
    setNewCamera(p => ({
      ...p,
      analytics: p.analytics.includes(analytic)
        ? p.analytics.filter(a => a !== analytic)
        : [...p.analytics, analytic],
    }));
  };

  const handleSave = () => {
    const payload = {
      name: newCamera.name,
      client_id: newCamera.clientId || null,
      stream_url: newCamera.streamUrl,
      protocol: newCamera.protocol,
      location: newCamera.location,
      resolution: newCamera.resolution,
      storage_path: newCamera.storagePath,
      retention_days: Number(newCamera.retentionDays),
      analytics: newCamera.analytics,
      video_encoding: newCamera.videoEncoding,
      max_bitrate: Number(newCamera.maxBitrate),
      brand: newCamera.brand || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload } as any);
    } else {
      insertMutation.mutate({ ...payload, stream_key: newStreamKey || undefined } as any);
    }

    resetForm();
  };

  const handleEdit = (camera: any) => {
    setEditingId(camera.id);
    const key = camera.stream_key || '';
    setEditingStreamKey(key);
    const serverIp = getServerIpForClient(camera.client_id || '');
    const protocol = camera.protocol || 'RTSP';
    const url = buildStreamUrl(protocol, serverIp, key);
    setNewCamera({
      name: camera.name,
      streamUrl: url,
      protocol,
      location: camera.location || '',
      resolution: camera.resolution || '1920x1080',
      clientId: camera.client_id || '',
      storagePath: camera.storage_path || '',
      retentionDays: String(camera.retention_days ?? 30),
      analytics: camera.analytics || [],
      videoEncoding: camera.video_encoding || 'H.264',
      maxBitrate: String(camera.max_bitrate || 4096),
      brand: camera.brand || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  // Map DB rows to CameraFeed expected format
  const mapCamera = (c: any) => {
    const client = clients.find((cl: any) => cl.id === c.client_id);
    // Generate stream URL from client's server IP + stream_key
    const resolvedIp = getServerIpForClient(c.client_id || '');
    const streamUrl = resolvedIp && c.stream_key
      ? `http://${resolvedIp}:${webrtcPort}/${c.stream_key}/`
      : c.stream_url || '';
    return {
      id: c.id,
      name: c.name,
      clientId: c.client_id || '',
      clientName: client?.name || 'Sem Cliente',
      streamUrl,
      protocol: c.protocol || 'RTSP',
      status: c.status || 'online',
      location: c.location || '',
      resolution: c.resolution || '',
      storagePath: c.storage_path || '',
      retentionDays: c.retention_days ?? 30,
      analytics: c.analytics || [],
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Câmeras</h1>
          <p className="text-sm text-muted-foreground font-mono">Gerenciamento de câmeras RTMP/RTSP</p>
        </div>
        <Button className="gap-2" onClick={handleAddCameraClick}>
              <Plus className="w-4 h-4" /> Nova Câmera
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); else setDialogOpen(true); }}>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingId ? 'Editar Câmera' : 'Adicionar Câmera'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Cliente</Label>
                <Select value={newCamera.clientId} onValueChange={v => {
                  const serverIp = getServerIpForClient(v);
                  const url = buildStreamUrl(newCamera.protocol, serverIp, currentStreamKey);
                  // Auto-fill storage path from client's storage server
                  const client = (clients as any[]).find((c: any) => c.id === v);
                  const storageServer = client?.storage_server_id
                    ? (storageServers as any[]).find((s: any) => s.id === client.storage_server_id)
                    : null;
                  const storagePath = storageServer?.storage_path || '';
                  setNewCamera(p => ({ ...p, clientId: v, streamUrl: url, storagePath }));
                }}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input value={newCamera.name} onChange={e => setNewCamera(p => ({ ...p, name: e.target.value }))} placeholder="CAM-10 Recepção" className="bg-muted border-border" />
              </div>
              {/* Stream Key - shown when editing (always same key regardless of protocol) */}
              {editingId && editingStreamKey && (
                <div className="bg-muted/50 rounded-lg p-3 border border-border space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Key className="w-3 h-3" /> Stream Key (gerada automaticamente)</Label>
                  <div className="flex gap-2">
                    <Input value={editingStreamKey} readOnly className="bg-muted border-border font-mono text-xs" />
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(editingStreamKey); toast({ title: 'Stream Key copiada!' }); }}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {(() => { const resolvedIp = getServerIpForClient(newCamera.clientId); return resolvedIp ? (
                    <div className="space-y-1 pt-1">
                       <div className="flex items-center gap-2">
                         <Badge variant="outline" className="text-[10px] shrink-0">RTMP</Badge>
                         <code className="text-[11px] font-mono text-muted-foreground truncate">rtmp://{resolvedIp}:{rtmpPort}/{editingStreamKey}</code>
                         <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => { navigator.clipboard.writeText(`rtmp://${resolvedIp}:${rtmpPort}/${editingStreamKey}`); toast({ title: 'URL RTMP copiada!' }); }}>
                           <Copy className="w-3 h-3" />
                         </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] shrink-0">WebRTC</Badge>
                        <code className="text-[11px] font-mono text-muted-foreground truncate">http://{resolvedIp}:{webrtcPort}/{editingStreamKey}/</code>
                        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => { navigator.clipboard.writeText(`http://${resolvedIp}:${webrtcPort}/${editingStreamKey}/`); toast({ title: 'URL WebRTC copiada!' }); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-destructive">⚠️ Cadastre um servidor de mídia em Configurações → Servidores para gerar os links.</p>
                  ); })()}
                </div>
              )}
              {!editingId && (
                <div className="bg-muted/30 rounded-lg p-3 border border-dashed border-border">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Key className="w-3 h-3" /> A Stream Key é gerada automaticamente e já é usada para montar a URL.
                  </p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">URL do Stream (gerada automaticamente)</Label>
                <Input value={newCamera.streamUrl} readOnly className="bg-muted border-border font-mono text-xs opacity-70" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Protocolo</Label>
                  <Select value={newCamera.protocol} onValueChange={v => {
                    const serverIp = getServerIpForClient(newCamera.clientId);
                    const url = buildStreamUrl(v, serverIp, currentStreamKey);
                    setNewCamera(p => ({ ...p, protocol: v as 'RTSP' | 'RTMP', streamUrl: url }));
                  }}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RTSP">RTSP</SelectItem>
                      <SelectItem value="RTMP">RTMP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Resolução</Label>
                  <Select value={newCamera.resolution} onValueChange={v => setNewCamera(p => ({ ...p, resolution: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESOLUTION_OPTIONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Marca da Câmera</Label>
                <Select value={newCamera.brand} onValueChange={v => setNewCamera(p => ({ ...p, brand: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione a marca" /></SelectTrigger>
                  <SelectContent>
                    {CAMERA_BRANDS.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Video className="w-3 h-3" /> Codec de Vídeo</Label>
                  <Select value={newCamera.videoEncoding} onValueChange={v => setNewCamera(p => ({ ...p, videoEncoding: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VIDEO_ENCODINGS.map(enc => (
                        <SelectItem key={enc} value={enc}>{enc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bit Rate Máx. (Kbps)</Label>
                  <Select value={newCamera.maxBitrate} onValueChange={v => setNewCamera(p => ({ ...p, maxBitrate: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BITRATE_OPTIONS.map(br => (
                        <SelectItem key={br} value={String(br)}>{br} Kbps</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Localização</Label>
                <Input value={newCamera.location} onChange={e => setNewCamera(p => ({ ...p, location: e.target.value }))} placeholder="Portaria" className="bg-muted border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><HardDrive className="w-3 h-3" /> Caminho de Gravação</Label>
                <Input value={newCamera.storagePath} onChange={e => setNewCamera(p => ({ ...p, storagePath: e.target.value }))} placeholder="D:\Gravacoes\Cliente\CAM01" className="bg-muted border-border font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Dias de Retenção</Label>
                <Select value={newCamera.retentionDays} onValueChange={v => setNewCamera(p => ({ ...p, retentionDays: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {RETENTION_OPTIONS.map(d => (
                      <SelectItem key={d} value={String(d)}>{d === 0 ? 'Ao Vivo' : `${d} dias`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><Brain className="w-3 h-3" /> Analíticos via IA</Label>
                <div className="grid grid-cols-1 gap-2 bg-muted/50 rounded-lg p-3 border border-border">
                  {ALL_ANALYTICS.map(analytic => (
                    <label key={analytic} className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-2 py-1.5 transition-colors">
                      <Checkbox
                        checked={newCamera.analytics.includes(analytic)}
                        onCheckedChange={() => toggleAnalytic(analytic)}
                      />
                      <span className="text-xs text-foreground">{ANALYTIC_LABELS[analytic]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">{editingId ? 'Salvar Alterações' : 'Adicionar Câmera'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar câmera..." className="pl-9 bg-muted border-border" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-muted border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="recording">Gravando</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProtocol} onValueChange={setFilterProtocol}>
          <SelectTrigger className="w-32 bg-muted border-border"><SelectValue placeholder="Protocolo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="RTSP">RTSP</SelectItem>
            <SelectItem value="RTMP">RTMP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cameras.map((camera: any) => {
          const mapped = mapCamera(camera);
          return <CameraFeed key={camera.id} camera={mapped as any} onEdit={() => handleEdit(camera)} onDelete={() => handleDelete(camera.id)} />;
        })}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">{totalCount} câmeras encontradas • Página {page + 1} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      {!isLoading && cameras.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Camera className="w-12 h-12 mb-3" />
          <p className="text-sm">Nenhuma câmera encontrada</p>
        </div>
      )}
    </div>
  );
};

export default Cameras;
