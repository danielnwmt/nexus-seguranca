import { Camera as CameraType } from '@/types/monitoring';
import { Video, VideoOff, Circle, Pencil, Trash2 } from 'lucide-react';

interface CameraFeedProps {
  camera: CameraType;
  compact?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const statusConfig = {
  online: { label: 'Online', dotClass: 'status-online', icon: Video },
  offline: { label: 'Offline', dotClass: 'status-offline', icon: VideoOff },
  recording: { label: 'REC', dotClass: 'bg-camera-recording', icon: Circle },
};

const CameraFeed = ({ camera, compact, onEdit, onDelete }: CameraFeedProps) => {
  const status = statusConfig[camera.status];

  return (
    <div className="rounded-lg border border-camera-border bg-camera-bg overflow-hidden group">
      {/* Simulated video feed */}
      <div className={`relative bg-camera-bg flex items-center justify-center ${compact ? 'h-32' : 'h-48'}`}>
        {camera.status === 'offline' ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <VideoOff className="w-8 h-8" />
            <span className="text-xs font-mono">SEM SINAL</span>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(175 80% 45% / 0.03) 2px, hsl(175 80% 45% / 0.03) 4px)',
            }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Video className="w-10 h-10 text-primary/20" />
            </div>
            <div className="absolute bottom-2 left-2 font-mono text-[10px] text-primary/60">
              {new Date().toLocaleString('pt-BR')}
            </div>
            {camera.status === 'recording' && (
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <Circle className="w-2 h-2 fill-camera-recording text-camera-recording pulse-alarm" />
                <span className="text-[10px] font-mono text-camera-recording font-bold">REC</span>
              </div>
            )}
          </>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-[10px]">
          <div className={`status-dot ${status.dotClass}`} />
          <span className="font-mono text-foreground">{status.label}</span>
        </div>
      </div>

      {/* Info bar */}
      <div className="px-3 py-2 border-t border-camera-border">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground truncate">{camera.name}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{camera.protocol} • {camera.resolution}</p>
            <p className="text-[10px] text-muted-foreground truncate">{camera.clientName}</p>
          </div>
          {(onEdit || onDelete) && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
              {onEdit && (
                <button onClick={onEdit} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {onDelete && (
                <button onClick={onDelete} className="w-6 h-6 rounded flex items-center justify-center hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraFeed;
