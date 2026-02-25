import { useState } from 'react';
import { Camera, Plus, Search, HardDrive, Calendar, Brain } from 'lucide-react';
import { mockCameras, mockClients } from '@/data/mockData';
import CameraFeed from '@/components/dashboard/CameraFeed';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { Camera as CameraType, AnalyticType } from '@/types/monitoring';
import { ANALYTIC_LABELS } from '@/types/monitoring';

const RETENTION_OPTIONS = [5, 10, 15, 20, 25, 30] as const;
const ALL_ANALYTICS: AnalyticType[] = ['lpr', 'weapon_detection', 'line_crossing', 'area_intrusion', 'loitering', 'human_car_classification', 'fallen_person', 'people_counting', 'tampering'];

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
}

const emptyForm: CameraForm = { name: '', streamUrl: '', protocol: 'RTSP', location: '', resolution: '1920x1080', clientId: '', storagePath: '', retentionDays: '30', analytics: [] };

const Cameras = () => {
  const [cameras, setCameras] = useState(mockCameras);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProtocol, setFilterProtocol] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<CameraType | null>(null);
  const [newCamera, setNewCamera] = useState<CameraForm>({ ...emptyForm });

  const filtered = cameras.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.clientName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchProtocol = filterProtocol === 'all' || c.protocol === filterProtocol;
    return matchSearch && matchStatus && matchProtocol;
  });

  const resetForm = () => {
    setNewCamera({ ...emptyForm });
    setEditingCamera(null);
    setDialogOpen(false);
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
    const client = mockClients.find(c => c.id === newCamera.clientId);
    if (editingCamera) {
      setCameras(prev => prev.map(c => c.id === editingCamera.id ? {
        ...c,
        name: newCamera.name,
        protocol: newCamera.protocol,
        streamUrl: newCamera.streamUrl,
        location: newCamera.location,
        resolution: newCamera.resolution,
        clientId: newCamera.clientId,
        clientName: client?.name || c.clientName,
        storagePath: newCamera.storagePath,
        retentionDays: Number(newCamera.retentionDays) as CameraType['retentionDays'],
        analytics: newCamera.analytics,
      } : c));
    } else {
      const cam: CameraType = {
        id: String(cameras.length + 1),
        name: newCamera.name,
        streamUrl: newCamera.streamUrl,
        protocol: newCamera.protocol,
        location: newCamera.location,
        resolution: newCamera.resolution,
        clientId: newCamera.clientId,
        clientName: client?.name || 'Sem Cliente',
        status: 'online',
        storagePath: newCamera.storagePath,
        retentionDays: Number(newCamera.retentionDays) as CameraType['retentionDays'],
        analytics: newCamera.analytics,
      };
      setCameras(prev => [...prev, cam]);
    }
    resetForm();
  };

  const handleEdit = (camera: CameraType) => {
    setEditingCamera(camera);
    setNewCamera({
      name: camera.name,
      streamUrl: camera.streamUrl,
      protocol: camera.protocol,
      location: camera.location,
      resolution: camera.resolution,
      clientId: camera.clientId,
      storagePath: camera.storagePath,
      retentionDays: String(camera.retentionDays),
      analytics: camera.analytics || [],
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setCameras(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Câmeras</h1>
          <p className="text-sm text-muted-foreground font-mono">Gerenciamento de câmeras RTMP/RTSP</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { setEditingCamera(null); setNewCamera({ ...emptyForm }); }}>
              <Plus className="w-4 h-4" /> Nova Câmera
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingCamera ? 'Editar Câmera' : 'Adicionar Câmera'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Cliente</Label>
                <Select value={newCamera.clientId} onValueChange={v => setNewCamera(p => ({ ...p, clientId: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {mockClients.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input value={newCamera.name} onChange={e => setNewCamera(p => ({ ...p, name: e.target.value }))} placeholder="CAM-10 Recepção" className="bg-muted border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">URL do Stream</Label>
                <Input value={newCamera.streamUrl} onChange={e => setNewCamera(p => ({ ...p, streamUrl: e.target.value }))} placeholder="rtsp://192.168.1.100:554/stream1" className="bg-muted border-border font-mono text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Protocolo</Label>
                  <Select value={newCamera.protocol} onValueChange={v => setNewCamera(p => ({ ...p, protocol: v as 'RTSP' | 'RTMP' }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RTSP">RTSP</SelectItem>
                      <SelectItem value="RTMP">RTMP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Resolução</Label>
                  <Input value={newCamera.resolution} onChange={e => setNewCamera(p => ({ ...p, resolution: e.target.value }))} className="bg-muted border-border font-mono text-xs" />
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
                      <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Analytics IA */}
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

              <Button onClick={handleSave} className="w-full">{editingCamera ? 'Salvar Alterações' : 'Adicionar Câmera'}</Button>
            </div>
          </DialogContent>
        </Dialog>
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
            <SelectItem value="RTSP">RTSP</SelectItem>
            <SelectItem value="RTMP">RTMP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(camera => (
          <CameraFeed key={camera.id} camera={camera} onEdit={() => handleEdit(camera)} onDelete={() => handleDelete(camera.id)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Camera className="w-12 h-12 mb-3" />
          <p className="text-sm">Nenhuma câmera encontrada</p>
        </div>
      )}
    </div>
  );
};

export default Cameras;
