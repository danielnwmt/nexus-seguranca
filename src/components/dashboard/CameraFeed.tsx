import { useState } from 'react';
import { Camera as CameraType, ANALYTIC_LABELS } from '@/types/monitoring';
import { Video, VideoOff, Circle, Pencil, Trash2, Play, Square, Eye, Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  const [isRecording, setIsRecording] = useState(camera.status === 'recording');
  const [isViewing, setIsViewing] = useState(false);

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
              {isViewing ? (
                <div className="text-primary/40 flex flex-col items-center gap-1">
                  <Eye className="w-8 h-8 animate-pulse" />
                  <span className="text-[10px] font-mono">AO VIVO</span>
                </div>
              ) : (
                <Video className="w-10 h-10 text-primary/20" />
              )}
            </div>
            <div className="absolute bottom-2 left-2 font-mono text-[10px] text-primary/60">
              {new Date().toLocaleString('pt-BR')}
            </div>
            {isRecording && (
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

        {/* Control buttons */}
        {camera.status !== 'offline' && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsRecording(!isRecording)}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isRecording ? 'bg-destructive/80 text-destructive-foreground' : 'bg-background/80 text-muted-foreground hover:text-foreground'}`}
                >
                  {isRecording ? <Square className="w-3 h-3" /> : <Circle className="w-3 h-3 fill-current" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{isRecording ? 'Parar Gravação' : 'Iniciar Gravação'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsViewing(!isViewing)}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isViewing ? 'bg-primary/80 text-primary-foreground' : 'bg-background/80 text-muted-foreground hover:text-foreground'}`}
                >
                  {isViewing ? <Eye className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{isViewing ? 'Fechar Visualização' : 'Visualizar Ao Vivo'}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="px-3 py-2 border-t border-camera-border">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground truncate">{camera.name}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{camera.protocol} • {camera.resolution} • {camera.retentionDays}d</p>
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
        {/* Analytics badges */}
        {camera.analytics && camera.analytics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {camera.analytics.map(a => (
              <Badge key={a} variant="outline" className="text-[9px] px-1.5 py-0 h-4 gap-1 border-primary/30 text-primary">
                <Brain className="w-2.5 h-2.5" />
                {ANALYTIC_LABELS[a]?.split(' ')[0]}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraFeed;
