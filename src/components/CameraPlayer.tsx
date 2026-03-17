import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video, VideoOff, Volume2, VolumeX, Camera as CameraIcon,
  Pause, Play, RefreshCw, Loader2, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { isLocalInstallation } from '@/hooks/useLocalApi';
import { useToast } from '@/hooks/use-toast';

type StreamType = 'webrtc' | 'hls' | 'iframe';
type LatencyLevel = 'good' | 'fair' | 'poor';

interface CameraPlayerProps {
  name: string;
  streamUrl: string;
  protocol?: string;
  status?: string;
  resolution?: string;
  className?: string;
  compact?: boolean;
  /** If true, uses iframe embed (default for MediaMTX WebRTC pages) */
  useIframe?: boolean;
  mediaServerIp?: string;
  webrtcPort?: number;
}

const RECONNECT_DELAY = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;

const latencyColors: Record<LatencyLevel, string> = {
  good: 'bg-emerald-500',
  fair: 'bg-yellow-500',
  poor: 'bg-red-500',
};

const CameraPlayer = ({
  name,
  streamUrl,
  protocol = 'RTSP',
  status = 'online',
  resolution,
  className = '',
  compact = false,
  useIframe = true,
  mediaServerIp,
  webrtcPort = 8889,
}: CameraPlayerProps) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);

  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [latency, setLatency] = useState<LatencyLevel>('good');
  const [streamType, setStreamType] = useState<StreamType>('iframe');

  // Resolve the playback URL
  const resolvedUrl = useCallback(() => {
    if (!streamUrl) return '';

    let host = '';
    let key = '';
    let port = webrtcPort;
    let scheme: 'http' | 'https' = 'http';

    const rtmpMatch = streamUrl.match(/^rtmp:\/\/([^:/]+)(?::\d+)?\/(.+)/);
    if (rtmpMatch) { host = rtmpMatch[1]; key = rtmpMatch[2]; }

    if (!key) {
      const rtspMatch = streamUrl.match(/^rtsp:\/\/([^:/]+)(?::\d+)?\/(.+)/);
      if (rtspMatch) { host = rtspMatch[1]; key = rtspMatch[2]; }
    }

    if (!key && streamUrl.startsWith('http')) {
      try {
        const parsed = new URL(streamUrl.replace(/\/whip\/?$/, ''));
        host = parsed.hostname;
        port = Number(parsed.port) || 8889;
        key = parsed.pathname.replace(/^\/+|\/+$/g, '');
        scheme = parsed.protocol === 'https:' ? 'https' : 'http';
      } catch {
        return streamUrl.replace(/\/whip\/?$/, '');
      }
    }

    if (!key) return '';

    if (window.location.protocol === 'https:' && isLocalInstallation()) {
      return `${window.location.origin}/webrtc/${key}`;
    }

    const finalHost = host || mediaServerIp || window.location.hostname;
    return `${scheme}://${finalHost}:${port}/${key}/`;
  }, [streamUrl, mediaServerIp, webrtcPort]);

  const url = resolvedUrl();

  // Determine stream type
  useEffect(() => {
    if (!url) return;
    if (useIframe) {
      setStreamType('iframe');
    } else if (url.includes('.m3u8')) {
      setStreamType('hls');
    } else {
      setStreamType('webrtc');
    }
  }, [url, useIframe]);

  // Auto-reconnect logic
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      setConnectionStatus('loading');
      // Force iframe reload
      if (iframeRef.current && streamType === 'iframe') {
        iframeRef.current.src = url;
      }
    }, RECONNECT_DELAY);
  }, [url, streamType]);

  // Monitor iframe load
  useEffect(() => {
    if (streamType !== 'iframe' || !url) return;
    setConnectionStatus('loading');
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
    }, 3000);
    return () => clearTimeout(timer);
  }, [url, streamType]);

  // Latency simulation (real latency monitoring requires WebRTC stats)
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const interval = setInterval(() => {
      if (streamType === 'webrtc' && pcRef.current) {
        pcRef.current.getStats().then(stats => {
          stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              const jitter = report.jitter || 0;
              if (jitter < 0.03) setLatency('good');
              else if (jitter < 0.1) setLatency('fair');
              else setLatency('poor');
            }
          });
        });
      } else {
        // For iframe mode, we approximate based on load success
        setLatency('good');
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [connectionStatus, streamType]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  // Snapshot
  const handleSnapshot = useCallback(() => {
    if (streamType === 'iframe') {
      toast({ title: 'Snapshot', description: 'Capture disponível apenas em modo WebRTC nativo.' });
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const link = document.createElement('a');
    link.download = `snapshot-${name}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast({ title: 'Snapshot salvo!' });
  }, [streamType, name, toast]);

  const handleManualReconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setConnectionStatus('loading');
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  }, [url]);

  if (status === 'offline' || !url) {
    return (
      <div className={`relative bg-camera-bg flex items-center justify-center rounded-lg border border-camera-border ${className}`}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <VideoOff className="w-8 h-8" />
          <span className="text-xs font-mono">SEM SINAL</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-lg border border-camera-border overflow-hidden group ${className}`}>
      {/* Video area */}
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        {streamType === 'iframe' ? (
          <iframe
            ref={iframeRef}
            src={playing ? url : ''}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; encrypted-media"
            sandbox="allow-scripts allow-same-origin"
            title={`Stream ${name}`}
          />
        ) : (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            muted={muted}
            playsInline
            autoPlay
          />
        )}

        {connectionStatus === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-camera-bg/80 z-10">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="text-xs font-mono text-muted-foreground ml-2">Conectando...</span>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-camera-bg/80 z-10">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <VideoOff className="w-8 h-8" />
              <span className="text-xs font-mono">FALHA NA CONEXÃO</span>
              <Button variant="outline" size="sm" onClick={handleManualReconnect} className="mt-1">
                <RefreshCw className="w-3 h-3 mr-1" /> Reconectar
              </Button>
            </div>
          </div>
        )}

        {/* Top overlay: status + latency */}
        <div className="absolute top-2 left-2 flex items-center gap-2 z-20">
          <Badge variant="outline" className="text-[10px] bg-background/70 backdrop-blur-sm border-none gap-1 px-2 py-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-500' : status === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-muted-foreground'}`} />
            {status === 'recording' ? 'REC' : status === 'online' ? 'AO VIVO' : status.toUpperCase()}
          </Badge>
          {connectionStatus === 'connected' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`w-2 h-2 rounded-full ${latencyColors[latency]}`} />
              </TooltipTrigger>
              <TooltipContent>
                Latência: {latency === 'good' ? 'Boa' : latency === 'fair' ? 'Regular' : 'Alta'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Bottom controls - visible on hover */}
        {!compact && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
                      onClick={() => setPlaying(!playing)}
                    >
                      {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{playing ? 'Pausar' : 'Reproduzir'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
                      onClick={() => setMuted(!muted)}
                    >
                      {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{muted ? 'Ativar Som' : 'Silenciar'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
                      onClick={handleSnapshot}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Snapshot</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
                      onClick={handleManualReconnect}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reconectar</TooltipContent>
                </Tooltip>
              </div>

              <div className="text-[10px] font-mono text-white/60">
                {resolution && <span>{resolution}</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info bar */}
      {!compact && (
        <div className="px-3 py-1.5 bg-card border-t border-camera-border">
          <p className="text-xs font-medium text-foreground truncate">{name}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{protocol} • {resolution || 'N/A'}</p>
        </div>
      )}
    </div>
  );
};

export default CameraPlayer;
