import { useState } from 'react';
import { Camera, Plus, Search, Wifi, WifiOff } from 'lucide-react';
import { mockCameras } from '@/data/mockData';
import CameraFeed from '@/components/dashboard/CameraFeed';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Camera as CameraType } from '@/types/monitoring';

const Cameras = () => {
  const [cameras, setCameras] = useState(mockCameras);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProtocol, setFilterProtocol] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCamera, setNewCamera] = useState({ name: '', streamUrl: '', protocol: 'RTSP' as 'RTSP' | 'RTMP', location: '', resolution: '1920x1080' });

  const filtered = cameras.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.clientName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchProtocol = filterProtocol === 'all' || c.protocol === filterProtocol;
    return matchSearch && matchStatus && matchProtocol;
  });

  const handleAdd = () => {
    const cam: CameraType = {
      id: String(cameras.length + 1),
      ...newCamera,
      clientId: '1',
      clientName: 'Novo Cliente',
      status: 'online',
    };
    setCameras(prev => [...prev, cam]);
    setNewCamera({ name: '', streamUrl: '', protocol: 'RTSP', location: '', resolution: '1920x1080' });
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Câmeras</h1>
          <p className="text-sm text-muted-foreground font-mono">Gerenciamento de câmeras RTMP/RTSP</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Nova Câmera
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Câmera</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
              <Button onClick={handleAdd} className="w-full">Adicionar Câmera</Button>
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
          <CameraFeed key={camera.id} camera={camera} />
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
