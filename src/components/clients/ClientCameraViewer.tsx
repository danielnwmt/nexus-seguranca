import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LayoutGrid } from 'lucide-react';
import CameraFeed from '@/components/dashboard/CameraFeed';
import { useCompanySettings } from '@/hooks/useCompanySettings';

interface ClientCameraViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: { id: string; name: string } | null;
  cameras: any[];
  allClients: any[];
}

const LAYOUTS = [
  { label: '8', cols: 4, count: 8 },
  { label: '16', cols: 4, count: 16 },
  { label: '32', cols: 8, count: 32 },
] as const;

const ClientCameraViewer = ({ open, onOpenChange, client, cameras, allClients }: ClientCameraViewerProps) => {
  const [layout, setLayout] = useState<8 | 16 | 32>(8);
  const { data: companySettings } = useCompanySettings();
  const mediaServerIp = (companySettings as any)?.media_server_ip || '';

  if (!client) return null;

  const clientCameras = cameras.filter((c: any) => c.client_id === client.id);
  const currentLayout = LAYOUTS.find(l => l.count === layout)!;

  const mapCamera = (c: any) => {
    const cl = allClients.find((cl: any) => cl.id === c.client_id);
    const streamUrl = mediaServerIp && c.stream_key
      ? `http://${mediaServerIp}:8888/${c.stream_key}/`
      : c.stream_url || '';
    return {
      id: c.id,
      name: c.name,
      clientId: c.client_id || '',
      clientName: cl?.name || 'Sem Cliente',
      streamUrl,
      protocol: c.protocol || 'RTSP',
      status: c.status || 'online',
      location: c.location || '',
      resolution: c.resolution || '',
      storagePath: c.storage_path || '',
      retentionDays: c.retention_days || 30,
      analytics: c.analytics || [],
    };
  };

  // Fill grid slots up to layout count
  const slots = Array.from({ length: layout }, (_, i) => clientCameras[i] || null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-foreground">
              Câmeras — {client.name} ({clientCameras.length} câmera{clientCameras.length !== 1 ? 's' : ''})
            </DialogTitle>
            <div className="flex items-center gap-1">
              {LAYOUTS.map(l => (
                <Button
                  key={l.count}
                  variant={layout === l.count ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7 px-3"
                  onClick={() => setLayout(l.count as 8 | 16 | 32)}
                >
                  <LayoutGrid className="w-3 h-3 mr-1" />
                  {l.label}
                </Button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div
          className="grid gap-2 mt-2"
          style={{ gridTemplateColumns: `repeat(${currentLayout.cols}, 1fr)` }}
        >
          {slots.map((cam, i) =>
            cam ? (
              <CameraFeed key={cam.id} camera={mapCamera(cam)} compact />
            ) : (
              <div
                key={`empty-${i}`}
                className="rounded-lg border border-dashed border-border bg-muted/20 flex items-center justify-center"
                style={{ minHeight: layout === 32 ? '100px' : '140px' }}
              >
                <span className="text-[10px] text-muted-foreground font-mono">SEM CÂMERA</span>
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientCameraViewer;
