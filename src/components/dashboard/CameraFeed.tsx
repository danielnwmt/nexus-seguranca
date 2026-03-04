import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera as CameraType, ANALYTIC_LABELS } from '@/types/monitoring';
import { Video, VideoOff, Circle, Pencil, Trash2, Play, Square, Eye, Brain, Film, ScanEye, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import WebRtcPlayer from './WebRtcPlayer';
import RecordingsViewer from '@/components/cameras/RecordingsViewer';
import { useAnalyzeCamera } from '@/hooks/useAnalyzeCamera';
import { getLocalApiBase, isLocalInstallation } from '@/hooks/useLocalApi';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const status = statusConfig[camera.status];
  const [isRecording, setIsRecording] = useState(camera.status === 'recording');
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [showRecordings, setShowRecordings] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const { analyzing, analyzeFromCanvas } = useAnalyzeCamera();
  const isAnalyzing = analyzing === camera.id;
  const AUTO_ANALYZE_INTERVAL = 30000; // 30 seconds

  const handleAnalyze = useCallback(async () => {
    if (!videoContainerRef.current) return;
    const videoEl = videoContainerRef.current.querySelector('video');
    if (!videoEl || videoEl.readyState < 2) return;
    await analyzeFromCanvas(videoEl, {
      id: camera.id,
      name: camera.name,
      clientId: camera.clientId,
      clientName: camera.clientName,
      analytics: camera.analytics || [],
    });
  }, [analyzeFromCanvas, camera]);

  // Auto-analyze when viewing a camera with analytics enabled
  useEffect(() => {
    if (!isViewing || !camera.analytics || camera.analytics.length === 0) return;
    
    // Initial analysis after 5 seconds (give HLS time to load)
    const initialTimeout = setTimeout(() => {
      handleAnalyze();
    }, 5000);

    // Then analyze every 30 seconds
    const interval = setInterval(() => {
      if (!analyzing) handleAnalyze();
    }, AUTO_ANALYZE_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isViewing, camera.analytics, handleAnalyze, analyzing]);

  // Handle recording start/stop via local API
  const handleToggleRecording = useCallback(async () => {
    if (!isLocalInstallation()) {
      toast({ title: 'Gravação disponível apenas na instalação local', variant: 'destructive' });
      return;
    }
    setIsRecordingLoading(true);
    try {
      const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      if (isRecording) {
        // Stop recording
        const resp = await fetch(`${getLocalApiBase()}/api/cameras/recording/stop`, {
          method: 'POST', headers,
          body: JSON.stringify({ camera_id: camera.id }),
        });
        const data = await resp.json();
        if (resp.ok) {
          setIsRecording(false);
          toast({ title: 'Gravação finalizada', description: `Duração: ${data.duration_seconds}s • ${data.file_size_mb} MB` });
        } else {
          toast({ title: 'Erro ao parar gravação', description: data.error, variant: 'destructive' });
        }
      } else {
        // Start recording
        const resp = await fetch(`${getLocalApiBase()}/api/cameras/recording/start`, {
          method: 'POST', headers,
          body: JSON.stringify({
            camera_id: camera.id,
            stream_key: camera.streamUrl?.split('/').filter(Boolean).pop() || camera.id,
            camera_name: camera.name,
            client_id: camera.clientId,
            client_name: camera.clientName,
            storage_path: camera.storagePath || '',
          }),
        });
        const data = await resp.json();
        if (resp.ok) {
          setIsRecording(true);
          toast({ title: 'Gravação iniciada', description: camera.name });
        } else {
          toast({ title: 'Erro ao iniciar gravação', description: data.error, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Erro de conexão com servidor local', description: err.message, variant: 'destructive' });
    } finally {
      setIsRecordingLoading(false);
    }
  }, [isRecording, camera, toast]);

  // Convert any stream URL (rtmp, rtsp, http) to WebRTC WHIP endpoint
  const getWebRtcUrl = (): string => {
    const url = camera.streamUrl;
    if (!url) return '';
    // Already a WHIP URL
    if (url.includes('/whip')) return url;
    // RTMP: rtmp://IP:PORT/KEY → http://IP:8889/KEY/whip
    const rtmpMatch = url.match(/^rtmp:\/\/([^:/]+)(?::\d+)?\/(.+)/);
    if (rtmpMatch) return `http://${rtmpMatch[1]}:8889/${rtmpMatch[2]}/whip`;
    // RTSP: rtsp://IP:PORT/KEY → http://IP:8889/KEY/whip
    const rtspMatch = url.match(/^rtsp:\/\/([^:/]+)(?::\d+)?\/(.+)/);
    if (rtspMatch) return `http://${rtspMatch[1]}:8889/${rtspMatch[2]}/whip`;
    // HTTP URL → extract host + path → build WHIP
    if (url.startsWith('http')) {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname.replace(/^\/+|\/+$/g, '');
        if (path) return `http://${parsed.hostname}:8889/${path}/whip`;
      } catch { /* ignore */ }
    }
    return '';
  };

  const webRtcUrl = getWebRtcUrl();

  return (
    <div className="rounded-lg border border-camera-border bg-camera-bg overflow-hidden group">
      {/* Video feed */}
      <div ref={videoContainerRef} className={`relative bg-camera-bg flex items-center justify-center ${compact ? 'h-32' : 'h-48'}`}>
        {camera.status === 'offline' ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <VideoOff className="w-8 h-8" />
            <span className="text-xs font-mono">SEM SINAL</span>
          </div>
        ) : isViewing && webRtcUrl ? (
          <WebRtcPlayer src={webRtcUrl} className="absolute inset-0" />
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
          </>
        )}

        {isRecording && (
          <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
            <Circle className="w-2 h-2 fill-camera-recording text-camera-recording pulse-alarm" />
            <span className="text-[10px] font-mono text-camera-recording font-bold">REC</span>
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-[10px]">
          <div className={`status-dot ${status.dotClass}`} />
          <span className="font-mono text-foreground">{status.label}</span>
        </div>

        {/* Control buttons */}
        {camera.status !== 'offline' && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            {/* AI Analyze - only if analytics enabled and viewing */}
            {isViewing && camera.analytics && camera.analytics.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isAnalyzing ? 'bg-primary/80 text-primary-foreground animate-pulse' : 'bg-background/80 text-muted-foreground hover:text-primary'}`}
                  >
                    {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanEye className="w-3 h-3" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{isAnalyzing ? 'Analisando...' : 'Analisar com IA'}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowRecordings(true)}
                  className="w-7 h-7 rounded flex items-center justify-center transition-colors bg-background/80 text-muted-foreground hover:text-foreground"
                >
                  <Film className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Gravações</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleRecording}
                  disabled={isRecordingLoading}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isRecording ? 'bg-destructive/80 text-destructive-foreground' : 'bg-background/80 text-muted-foreground hover:text-foreground'}`}
                >
                  {isRecordingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : isRecording ? <Square className="w-3 h-3" /> : <Circle className="w-3 h-3 fill-current" />}
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
            <p className="text-[10px] text-muted-foreground font-mono">{camera.protocol} • {camera.resolution} • {camera.retentionDays === 0 ? 'Ao Vivo' : `${camera.retentionDays}d`}</p>
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

      <RecordingsViewer
        open={showRecordings}
        onOpenChange={setShowRecordings}
        camera={{ id: camera.id, name: camera.name, clientName: camera.clientName }}
      />
    </div>
  );
};

export default CameraFeed;
