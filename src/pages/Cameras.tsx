import { useState, useMemo } from 'react';
import { Camera, Plus, Search, HardDrive, Calendar, Brain, Video, Key, Copy, MapPin, Film, Eye, Pencil, Trash2, VideoOff, Circle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import type { AnalyticType } from '@/types/monitoring';
import { ANALYTIC_LABELS } from '@/types/monitoring';
import { useTableQuery, usePaginatedQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';
import LineCrossingEditor, { type LineCrossingLine } from '@/components/cameras/LineCrossingEditor';
import RecordingsViewer from '@/components/cameras/RecordingsViewer';

// ── Options as specified ──
const PROTOCOL_OPTIONS = ['RTSP', 'RTMP'] as const;
const RESOLUTION_OPTIONS = ['1920x1080', '1280x720', '640x480'] as const;
const BRAND_OPTIONS = [
  'Intelbras', 'Hikvision', 'Dahua', 'Axis', 'Bosch', 'Samsung', 'Hanwha',
  'Vivotek', 'Pelco', 'Avigilon', 'Honeywell', 'Uniview', 'TVT', 'Giga',
  'Motorola', 'TP-Link', 'Reolink', 'Amcrest', 'Lorex', 'Swann',
  'Milestone', 'Mobotix', 'FLIR', 'Tiandy', 'Provision-ISR', 'Sunell',
  'Milesight', 'Geovision', 'CP Plus', 'Wisenet', 'Genérica',
] as const;
const CODEC_OPTIONS = ['H.264', 'H.265'] as const;
const BITRATE_OPTIONS = [2048, 4096, 8192] as const;
const RETENTION_OPTIONS = [0, 5, 10, 15, 20, 25, 30] as const;
const ALL_ANALYTICS: AnalyticType[] = ['lpr', 'weapon_detection', 'line_crossing', 'area_intrusion', 'loitering', 'human_car_classification', 'fallen_person', 'people_counting', 'tampering'];

const STORAGE_BASE = '/opt/nexus-monitoramento/gravacoes';

/** Remove acentos e caracteres especiais, substitui espaços por hifens, tudo lowercase */
const sanitizePath = (name: string): string => {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
};

interface CameraForm {
  name: string;
  streamUrl: string;
  protocol: string;
  location: string;
  resolution: string;
  clientId: string;
  storagePath: string;
  retentionDays: string;
  analytics: AnalyticType[];
  videoEncoding: string;
  maxBitrate: string;
  brand: string;
  latitude: string;
  longitude: string;
  analyticsConfig: { line_crossing_lines?: LineCrossingLine[]; [key: string]: any };
}

const emptyForm: CameraForm = {
  name: '', streamUrl: '', protocol: 'RTSP', location: '', resolution: '1920x1080',
  clientId: '', storagePath: '', retentionDays: '30', analytics: [],
  videoEncoding: 'H.264', maxBitrate: '4096', brand: '', latitude: '', longitude: '',
  analyticsConfig: {},
};

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
  const [newStreamKey, setNewStreamKey] = useState<string>('');
  const [page, setPage] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [recordingsCamera, setRecordingsCamera] = useState<{ id: string; name: string; clientName?: string } | null>(null);
  const [recordingsOpen, setRecordingsOpen] = useState(false);
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

  const currentStreamKey = editingId ? editingStreamKey : newStreamKey;

  const buildStreamUrl = (protocol: string, serverIp: string, key: string) => {
    if (!serverIp || !key) return '';
    if (protocol === 'RTMP') return `rtmp://${serverIp}:${rtmpPort}/${key}`;
    return `rtsp://${serverIp}:8554/${key}`;
  };

  const generateStreamKey = (): string => {
    const length = Math.floor(Math.random() * 8) + 5;
    let key = '';
    for (let i = 0; i < length; i++) {
      key += (i === 0 ? Math.floor(Math.random() * 9) + 1 : Math.floor(Math.random() * 10)).toString();
    }
    return key;
  };

  /** Auto-generate storage path from camera name */
  const buildStoragePath = (cameraName: string): string => {
    if (!cameraName.trim()) return '';
    return `${STORAGE_BASE}/${sanitizePath(cameraName)}`;
  };

  const resetForm = () => {
    setNewCamera({ ...emptyForm });
    setEditingId(null);
    setEditingStreamKey('');
    setNewStreamKey('');
    setDialogOpen(false);
  };

  const handleAddCameraClick = () => {
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
  };

  const toggleAnalytic = (analytic: AnalyticType) => {
    setNewCamera(p => ({
      ...p,
      analytics: p.analytics.includes(analytic)
        ? p.analytics.filter(a => a !== analytic)
        : [...p.analytics, analytic],
    }));
  };

  const handleSave = async () => {
    if (!newCamera.name.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Informe o nome da câmera para salvar.', variant: 'destructive' });
      return;
    }

    // Auto-generate storage path from camera name
    const storagePath = buildStoragePath(newCamera.name);

    const buildPayload = (includeAnalyticsConfig: boolean) => ({
      name: newCamera.name.trim(),
      client_id: newCamera.clientId || null,
      stream_url: newCamera.streamUrl,
      protocol: newCamera.protocol,
      location: newCamera.location,
      resolution: newCamera.resolution,
      storage_path: storagePath,
      retention_days: Number(newCamera.retentionDays),
      analytics: newCamera.analytics,
      video_encoding: newCamera.videoEncoding,
      max_bitrate: Number(newCamera.maxBitrate),
      brand: newCamera.brand || null,
      latitude: newCamera.latitude ? Number(newCamera.latitude) : null,
      longitude: newCamera.longitude ? Number(newCamera.longitude) : null,
      ...(includeAnalyticsConfig ? { analytics_config: newCamera.analyticsConfig || {} } : {}),
    });

    const persistCamera = async (includeAnalyticsConfig: boolean) => {
      const payload = buildPayload(includeAnalyticsConfig);
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...payload } as any);
      } else {
        await insertMutation.mutateAsync({ ...payload, stream_key: newStreamKey || undefined } as any);
      }
    };

    setIsSaving(true);
    try {
      await persistCamera(true);
      toast({ title: 'Câmera salva com sucesso' });
      resetForm();
    } catch (error) {
      const firstMessage = error instanceof Error ? error.message : 'Falha inesperada ao salvar câmera.';
      const shouldRetry = /analytics_config|schema cache|Could not find/i.test(firstMessage);
      if (shouldRetry) {
        try {
          await persistCamera(false);
          toast({ title: 'Câmera salva com sucesso', description: 'Salva em modo de compatibilidade.' });
          resetForm();
          return;
        } catch (retryError) {
          const retryMsg = retryError instanceof Error ? retryError.message : 'Falha inesperada.';
          toast({ title: 'Erro ao salvar câmera', description: retryMsg, variant: 'destructive' });
          return;
        }
      }
      console.error('Erro ao salvar câmera:', error);
      toast({ title: 'Erro ao salvar câmera', description: firstMessage, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
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
      latitude: camera.latitude ? String(camera.latitude) : '',
      longitude: camera.longitude ? String(camera.longitude) : '',
      analyticsConfig: camera.analytics_config || {},
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  const getClientName = (clientId: string | null) => {
    if (!clientId) return 'Sem Cliente';
    const client = (clients as any[]).find(c => c.id === clientId);
    return client?.name || 'Sem Cliente';
  };

  // Auto-update storagePath when camera name changes
  const handleNameChange = (name: string) => {
    const storagePath = buildStoragePath(name);
    setNewCamera(p => ({ ...p, name, storagePath }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Câmeras</h1>
          <p className="text-sm text-muted-foreground font-mono">
            {totalCount} dispositivo{totalCount !== 1 ? 's' : ''} cadastrado{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Button className="gap-2" onClick={handleAddCameraClick}>
          <Plus className="w-4 h-4" /> Nova Câmera
        </Button>
      </div>

      {/* Filters */}
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
            {PROTOCOL_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Camera Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cameras.map((camera: any) => {
          const isOnline = camera.status === 'online' || camera.status === 'recording';
          const isRecording = camera.status === 'recording';
          const retDays = camera.retention_days ?? 30;
          const clientName = getClientName(camera.client_id);

          return (
            <Card key={camera.id} className="group overflow-hidden border-border bg-card hover:border-primary/30 transition-all">
              {/* Thumbnail area */}
              <div className="relative bg-muted aspect-video flex items-center justify-center">
                <div className="absolute inset-0 opacity-5" style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--primary) / 0.05) 2px, hsl(var(--primary) / 0.05) 4px)',
                }} />

                {isOnline ? (
                  <Video className="w-10 h-10 text-primary/20" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <VideoOff className="w-8 h-8" />
                    <span className="text-[10px] font-mono">SEM SINAL</span>
                  </div>
                )}

                {/* Status badge */}
                <div className="absolute top-2 left-2">
                  <Badge
                    variant={isOnline ? 'default' : 'secondary'}
                    className={`text-[10px] px-2 py-0.5 gap-1 font-mono ${
                      isRecording
                        ? 'bg-destructive text-destructive-foreground'
                        : isOnline
                        ? 'bg-emerald-600 text-white'
                        : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}
                  >
                    <Circle className={`w-2 h-2 fill-current ${isRecording ? 'animate-pulse' : ''}`} />
                    {isRecording ? 'REC' : isOnline ? 'Online' : 'Offline'}
                  </Badge>
                </div>

                {/* Retention badge */}
                <div className="absolute top-2 right-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        <HardDrive className="w-3 h-3" />
                        {retDays === 0 ? 'LIVE' : `${retDays}d`}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {retDays === 0 ? 'Apenas ao vivo (sem gravação)' : `Retenção de ${retDays} dias`}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Protocol badge */}
                <Badge variant="outline" className="absolute bottom-2 left-2 text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary/70 font-mono">
                  {camera.protocol || 'RTSP'}
                </Badge>
              </div>

              {/* Info */}
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{camera.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{clientName}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => handleEdit(camera)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Editar</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => handleDelete(camera.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Tech info */}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                  {camera.resolution && <span>{camera.resolution}</span>}
                  {camera.video_encoding && <span>• {camera.video_encoding}</span>}
                  {camera.brand && <span>• {camera.brand}</span>}
                </div>

                {camera.location && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{camera.location}</span>
                  </div>
                )}

                {/* Analytics badges */}
                {camera.analytics && camera.analytics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {camera.analytics.slice(0, 3).map((a: string) => (
                      <Badge key={a} variant="outline" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 border-primary/30 text-primary">
                        <Brain className="w-2.5 h-2.5" />
                        {ANALYTIC_LABELS[a as AnalyticType]?.split(' ')[0] || a}
                      </Badge>
                    ))}
                    {camera.analytics.length > 3 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border text-muted-foreground">
                        +{camera.analytics.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => {
                      setRecordingsCamera({ id: camera.id, name: camera.name, clientName });
                      setRecordingsOpen(true);
                    }}
                  >
                    <Film className="w-3.5 h-3.5" />
                    Ver Gravações
                  </Button>
                  {camera.stream_key && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            navigator.clipboard.writeText(camera.stream_key);
                            toast({ title: 'Stream Key copiada!' });
                          }}
                        >
                          <Key className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar Stream Key</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">{totalCount} câmeras • Página {page + 1} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      {!isLoading && cameras.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Camera className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm">Nenhuma câmera encontrada</p>
          <p className="text-xs mt-1">Clique em "Nova Câmera" para adicionar</p>
        </div>
      )}

      {/* ═══════════ Camera Form Dialog ═══════════ */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); else setDialogOpen(true); }}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingId ? 'Editar Câmera' : 'Adicionar Câmera'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cliente */}
            <div>
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Select value={newCamera.clientId} onValueChange={v => {
                const serverIp = getServerIpForClient(v);
                const url = buildStreamUrl(newCamera.protocol, serverIp, currentStreamKey);
                setNewCamera(p => ({ ...p, clientId: v, streamUrl: url }));
              }}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nome */}
            <div>
              <Label className="text-xs text-muted-foreground">Nome da Câmera</Label>
              <Input
                value={newCamera.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="CAM-01 Recepção"
                className="bg-muted border-border"
              />
            </div>

            {/* Stream Key info */}
            {editingId && editingStreamKey && (
              <div className="bg-muted/50 rounded-lg p-3 border border-border space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Key className="w-3 h-3" /> Stream Key</Label>
                <div className="flex gap-2">
                  <Input value={editingStreamKey} readOnly className="bg-muted border-border font-mono text-xs" />
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(editingStreamKey); toast({ title: 'Stream Key copiada!' }); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
            {!editingId && (
              <div className="bg-muted/30 rounded-lg p-3 border border-dashed border-border">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Key className="w-3 h-3" /> A Stream Key será gerada automaticamente ao salvar.
                </p>
              </div>
            )}

            {/* URL do Stream */}
            <div>
              <Label className="text-xs text-muted-foreground">URL do Stream (automática)</Label>
              <Input value={newCamera.streamUrl} readOnly className="bg-muted border-border font-mono text-xs opacity-70" />
            </div>

            {/* Protocolo + Resolução */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Protocolo</Label>
                <Select value={newCamera.protocol} onValueChange={v => {
                  const serverIp = getServerIpForClient(newCamera.clientId);
                  const url = buildStreamUrl(v, serverIp, currentStreamKey);
                  setNewCamera(p => ({ ...p, protocol: v, streamUrl: url }));
                }}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROTOCOL_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Resolução</Label>
                <Select value={newCamera.resolution} onValueChange={v => setNewCamera(p => ({ ...p, resolution: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOLUTION_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Marca */}
            <div>
              <Label className="text-xs text-muted-foreground">Marca da Câmera</Label>
              <Select value={newCamera.brand} onValueChange={v => setNewCamera(p => ({ ...p, brand: v }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione a marca" /></SelectTrigger>
                <SelectContent>
                  {BRAND_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Codec + Bitrate */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Video className="w-3 h-3" /> Codec de Vídeo</Label>
                <Select value={newCamera.videoEncoding} onValueChange={v => setNewCamera(p => ({ ...p, videoEncoding: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CODEC_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Bit Rate Máx. (Kbps)</Label>
                <Select value={newCamera.maxBitrate} onValueChange={v => setNewCamera(p => ({ ...p, maxBitrate: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BITRATE_OPTIONS.map(br => <SelectItem key={br} value={String(br)}>{br} Kbps</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Localização */}
            <div>
              <Label className="text-xs text-muted-foreground">Localização</Label>
              <Input value={newCamera.location} onChange={e => setNewCamera(p => ({ ...p, location: e.target.value }))} placeholder="Portaria, Corredor, Estacionamento..." className="bg-muted border-border" />
            </div>

            {/* Caminho de Gravação (auto-gerado, desabilitado) */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><HardDrive className="w-3 h-3" /> Caminho de Gravação</Label>
              <Input
                value={newCamera.storagePath || (newCamera.name ? buildStoragePath(newCamera.name) : STORAGE_BASE + '/...')}
                readOnly
                disabled
                className="bg-muted border-border font-mono text-xs opacity-70"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Gerado automaticamente a partir do nome da câmera</p>
            </div>

            {/* Dias de Retenção */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Dias de Retenção</Label>
              <Select value={newCamera.retentionDays} onValueChange={v => setNewCamera(p => ({ ...p, retentionDays: v }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {RETENTION_OPTIONS.map(d => (
                    <SelectItem key={d} value={String(d)}>{d === 0 ? 'Ao Vivo (sem gravação)' : `${d} dias`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Analíticos */}
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

            {/* Line Crossing Editor */}
            {newCamera.analytics.includes('line_crossing') && (
              <div className="border border-primary/20 rounded-lg p-3 bg-primary/5">
                <Label className="text-xs text-primary font-semibold mb-2 block">🔲 Configurar Linhas de Cruzamento</Label>
                <LineCrossingEditor
                  lines={newCamera.analyticsConfig?.line_crossing_lines || []}
                  onChange={(lines) => setNewCamera(p => ({
                    ...p,
                    analyticsConfig: { ...p.analyticsConfig, line_crossing_lines: lines },
                  }))}
                />
              </div>
            )}

            {/* Coordenadas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Latitude</Label>
                <Input type="number" step="any" value={newCamera.latitude} onChange={e => setNewCamera(p => ({ ...p, latitude: e.target.value }))} placeholder="-23.5505" className="bg-muted border-border font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Longitude</Label>
                <Input type="number" step="any" value={newCamera.longitude} onChange={e => setNewCamera(p => ({ ...p, longitude: e.target.value }))} placeholder="-46.6333" className="bg-muted border-border font-mono text-xs" />
              </div>
            </div>

            <Button onClick={handleSave} disabled={isSaving || insertMutation.isPending || updateMutation.isPending} className="w-full">
              {isSaving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Adicionar Câmera'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recordings Viewer */}
      <RecordingsViewer
        open={recordingsOpen}
        onOpenChange={setRecordingsOpen}
        camera={recordingsCamera}
      />
    </div>
  );
};

export default Cameras;
