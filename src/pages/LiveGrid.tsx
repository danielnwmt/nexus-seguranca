import { useState, useEffect, useMemo } from 'react';
import { Camera, Grid2X2, Grid3X3, LayoutGrid, Maximize2, Minimize2, Video } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useTableQuery } from '@/hooks/useSupabaseQuery';
import { isLocalInstallation } from '@/hooks/useLocalApi';
import LazyVideoCell from '@/components/dashboard/LazyVideoCell';

type GridLayout = '2x2' | '3x3' | '4x4';

const gridConfig: Record<GridLayout, { cols: string; maxCams: number }> = {
  '2x2': { cols: 'grid-cols-2', maxCams: 4 },
  '3x3': { cols: 'grid-cols-3', maxCams: 9 },
  '4x4': { cols: 'grid-cols-4', maxCams: 16 },
};

const LiveGrid = () => {
  const { data: cameras = [] } = useTableQuery('cameras');
  const { data: clients = [] } = useTableQuery('clients');
  const { data: mediaServers = [] } = useTableQuery('media_servers');

  const [grid, setGrid] = useState<GridLayout>('3x3');
  const [selectedClient, setSelectedClient] = useState('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCam, setSelectedCam] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const filteredCameras = useMemo(() => {
    const list = selectedClient === 'all'
      ? cameras
      : cameras.filter((c: any) => c.client_id === selectedClient);
    return list.filter((c: any) => c.status !== 'offline');
  }, [cameras, selectedClient]);

  const { maxCams } = gridConfig[grid];
  const totalPages = Math.ceil(filteredCameras.length / maxCams);
  const visibleCameras = filteredCameras.slice(page * maxCams, (page + 1) * maxCams);

  // Auto-cycle pages every 30s if more than 1 page
  useEffect(() => {
    if (totalPages <= 1) return;
    const interval = setInterval(() => {
      setPage(p => (p + 1) % totalPages);
    }, 30000);
    return () => clearInterval(interval);
  }, [totalPages]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const getWebRtcUrl = (cam: any) => {
    const streamUrl = cam.stream_url || '';
    if (!streamUrl) return '';

    let streamHost = '';
    let streamKey = '';
    let streamPort = 8889;
    let scheme: 'http' | 'https' = 'http';

    const rtmpMatch = streamUrl.match(/^rtmp:\/\/([^:/]+)(?::\d+)?\/(.+)/);
    if (rtmpMatch) {
      streamHost = rtmpMatch[1];
      streamKey = rtmpMatch[2];
    }

    if (!streamKey) {
      const rtspMatch = streamUrl.match(/^rtsp:\/\/([^:/]+)(?::\d+)?\/(.+)/);
      if (rtspMatch) {
        streamHost = rtspMatch[1];
        streamKey = rtspMatch[2];
      }
    }

    if (!streamKey && streamUrl.startsWith('http')) {
      try {
        const parsed = new URL(streamUrl.replace(/\/whip\/?$/, ''));
        streamHost = parsed.hostname;
        streamPort = Number(parsed.port) || 8889;
        streamKey = parsed.pathname.replace(/^\/+|\/+$/g, '');
        scheme = parsed.protocol === 'https:' ? 'https' : 'http';
      } catch {
        return streamUrl.replace(/\/whip\/?$/, '');
      }
    }

    if (!streamKey) return '';

    if (window.location.protocol === 'https:' && isLocalInstallation()) {
      return `${window.location.origin}/webrtc/${streamKey}`;
    }

    const host = streamHost || (mediaServers as any[])[0]?.ip_address || window.location.hostname;
    return `${scheme}://${host}:${streamPort}/${streamKey}/`;
  };

  return (
    <div className={`space-y-3 ${isFullscreen ? 'bg-background p-2' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" /> Monitoramento ao Vivo
          </h1>
          <Badge variant="outline" className="text-[10px]">
            {filteredCameras.length} câmeras
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Grid selector */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            {(['2x2', '3x3', '4x4'] as GridLayout[]).map((g) => {
              const Icon = g === '2x2' ? Grid2X2 : g === '3x3' ? Grid3X3 : LayoutGrid;
              return (
                <Tooltip key={g}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setGrid(g); setPage(0); }}
                      className={`p-1.5 transition-colors ${grid === g ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{g}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setPage(0); }}>
            <SelectTrigger className="w-44 h-8 text-xs bg-muted border-border">
              <SelectValue placeholder="Filtrar por cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Clientes</SelectItem>
              {(clients as any[]).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${page === i ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                />
              ))}
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia'}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Expanded single camera view */}
      {selectedCam ? (
        <div className="relative">
          <button
            onClick={() => setSelectedCam(null)}
            className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm rounded px-2 py-1 text-xs text-foreground hover:bg-background"
          >
            ✕ Voltar ao Grid
          </button>
          {(() => {
            const cam = cameras.find((c: any) => c.id === selectedCam) as any;
            if (!cam) return null;
            const url = getWebRtcUrl(cam);
            const client = (clients as any[]).find(c => c.id === cam.client_id);
            return (
              <div className="rounded-lg border border-border overflow-hidden bg-black">
                <div className="relative" style={{ height: 'calc(100vh - 160px)' }}>
                  {url ? (
                    <iframe
                      src={url}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="autoplay; encrypted-media"
                      sandbox="allow-scripts allow-same-origin"
                      title={cam.name}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      <Camera className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <div className="px-3 py-2 bg-card border-t border-border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{cam.name}</p>
                    <p className="text-xs text-muted-foreground">{client?.name || ''} • {cam.protocol} • {cam.resolution}</p>
                  </div>
                  <Badge className={cam.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive'}>
                    {cam.status}
                  </Badge>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* Grid view */
        <div className={`grid ${gridConfig[grid].cols} gap-1`}>
          {visibleCameras.map((cam: any) => {
            const url = getWebRtcUrl(cam);
            const client = (clients as any[]).find((c: any) => c.id === cam.client_id);
            return (
              <LazyVideoCell
                key={cam.id}
                cam={cam}
                clientName={client?.name}
                url={url}
                onClick={() => setSelectedCam(cam.id)}
              />
            );
          })}
          {/* Fill empty slots */}
          {Array.from({ length: Math.max(0, maxCams - visibleCameras.length) }, (_, i) => (
            <div
              key={`empty-${i}`}
              className="relative bg-muted/20 rounded border border-border/30"
              style={{ aspectRatio: '16/9' }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
                <Camera className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveGrid;
