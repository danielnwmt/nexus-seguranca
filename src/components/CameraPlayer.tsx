import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video, VideoOff, Volume2, VolumeX, Camera as CameraIcon,
  Pause, Play, RefreshCw, Loader2, Download, Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { isLocalInstallation } from '@/hooks/useLocalApi';
import { useToast } from '@/hooks/use-toast';
import AnalyticsOverlay from '@/components/dashboard/AnalyticsOverlay';

type StreamMode = 'webrtc-iframe' | 'hls' | 'webrtc-native';
type LatencyLevel = 'good' | 'fair' | 'poor';

interface CameraPlayerProps {
  name: string;
  streamUrl: string;
  protocol?: string;
  status?: string;
  resolution?: string;
  className?: string;
  compact?: boolean;
  useIframe?: boolean;
  mediaServerIp?: string;
  webrtcPort?: number;
  hlsPort?: number;
  cameraId?: string;
  showAnalytics?: boolean;
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
  hlsPort = 8888,
  cameraId,
  showAnalytics = true,
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
  const [streamMode, setStreamMode] = useState<StreamMode>('webrtc-iframe');

  // Extract stream key from URL
  const extractStreamKey = useCallback((): string => {
    if (!streamUrl) return '';
    const rtmpMatch = streamUrl.match(/^rtmp:\/\/[^:/]+(?::\d+)?\/(.+)/);
    if (rtmpMatch) return rtmpMatch[1];
    const rtspMatch = streamUrl.match(/^rtsp:\/\/[^:/]+(?::\d+)?\/(.+)/);
    if (rtspMatch) return rtspMatch[1];
    if (streamUrl.startsWith('http')) {
      try {
        const parsed = new URL(streamUrl.replace(/\/whip\/?$/, ''));
        return parsed.pathname.replace(/^\/+|\/+$/g, '');
      } catch { return ''; }
    }
    return '';
  }, [streamUrl]);

  // Build WebRTC iframe URL
  const buildWebRtcUrl = useCallback((): string => {
    const key = extractStreamKey();
    if (!key) return '';

    if (window.location.protocol === 'https:' && isLocalInstallation()) {
      return `${window.location.origin}/webrtc/${key}`;
    }

    const host = mediaServerIp || window.location.hostname;
    return `http://${host}:${webrtcPort}/${key}/`;
  }, [extractStreamKey, mediaServerIp, webrtcPort]);

  // Build HLS fallback URL
  const buildHlsUrl = useCallback((): string => {
    const key = extractStreamKey();
    if (!key) return '';

    if (window.location.protocol === 'https:' && isLocalInstallation()) {
      return `${window.location.origin}/hls/${key}/index.m3u8`;
    }

    const host = mediaServerIp || window.location.hostname;
    return `http://${host}:${hlsPort}/${key}/index.m3u8`;
  }, [extractStreamKey, mediaServerIp, hlsPort]);

  const webrtcUrl = buildWebRtcUrl();
  const hlsUrl = buildHlsUrl();

  // Determine initial stream mode
  useEffect(() => {
    if (!webrtcUrl) return;
    if (useIframe) {
      setStreamMode('webrtc-iframe');
    } else {
      setStreamMode('webrtc-iframe');
    }
  }, [webrtcUrl, useIframe]);

  // HLS playback via native video element
  useEffect(() => {
    if (streamMode !== 'hls' || !hlsUrl || !videoRef.current) return;
    const video = videoRef.current;

    const startHls = async () => {
      // Try native HLS first (Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        video.play().catch(() => {});
        setConnectionStatus('connected');
        return;
      }

      // Use hls.js dynamically
      try {
        const Hls = (await import('hls.js')).default;
        if (!Hls.isSupported()) {
          setConnectionStatus('error');
          return;
        }
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setConnectionStatus('error');
            scheduleReconnect();
          }
        });
        return () => hls.destroy();
      } catch {
        setConnectionStatus('error');
      }
    };

    startHls();
  }, [streamMode, hlsUrl]);

  // Auto-reconnect logic
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus('error');
      return;
    }
    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      setConnectionStatus('loading');

      if (streamMode === 'webrtc-iframe' && iframeRef.current) {
        iframeRef.current.src = webrtcUrl;
      }
    }, RECONNECT_DELAY);
  }, [webrtcUrl, streamMode]);

  // Monitor iframe load
  useEffect(() => {
    if (streamMode !== 'webrtc-iframe' || !webrtcUrl) return;
    setConnectionStatus('loading');
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
    }, 3000);
    return () => clearTimeout(timer);
  }, [webrtcUrl, streamMode]);

  // Latency monitor
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const interval = setInterval(() => {
      if (streamMode === 'webrtc-native' && pcRef.current) {
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
        setLatency('good');
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [connectionStatus, streamMode]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  // Fallback to HLS
  const switchToHls = useCallback(() => {
    if (!hlsUrl) return;
    setStreamMode('hls');
    setConnectionStatus('loading');
    reconnectAttemptsRef.current = 0;
    toast({ title: 'Alternando para HLS', description: 'WebRTC indisponível, usando HLS como fallback.' });
  }, [hlsUrl, toast]);

  // Snapshot
  const handleSnapshot = useCallback(() => {
    if (streamMode === 'webrtc-iframe') {
      toast({ title: 'Snapshot', description: 'Capture disponível apenas em modo HLS/WebRTC nativo.' });
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
  }, [streamMode, name, toast]);

  const handleManualReconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setStreamMode('webrtc-iframe');
    setConnectionStatus('loading');
    if (iframeRef.current) {
      iframeRef.current.src = webrtcUrl;
    }
  }, [webrtcUrl]);

  // Fullscreen
  const handleFullscreen = useCallback(() => {
    const container = iframeRef.current?.parentElement?.parentElement;
    if (container?.requestFullscreen) {
      container.requestFullscreen();
    }
  }, []);

  if (status === 'offline' || !webrtcUrl) {
    return (
      <div className={`relative bg-camera-bg flex items-center justify-center rounded-lg border border-camera-border ${className}`} style={{ aspectRatio: '16/9' }}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <VideoOff className="w-8 h-8" />
          <span className="text-[10px] font-mono tracking-wider">SEM SINAL</span>
          <span className="text-[9px] font-mono text-muted-foreground/60">{name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-lg border border-camera-border overflow-hidden group ${className}`}>
      {/* Video area */}
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        {streamMode === 'webrtc-iframe' ? (
          <iframe
            ref={iframeRef}
            src={playing ? webrtcUrl : ''}
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
            <span className="text-[10px] font-mono text-muted-foreground ml-2">Conectando...</span>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-camera-bg/80 z-10">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <VideoOff className="w-8 h-8" />
              <span className="text-[10px] font-mono">FALHA NA CONEXÃO</span>
              <div className="flex gap-2 mt-1">
                <Button variant="outline" size="sm" onClick={handleManualReconnect} className="text-[10px] h-7">
                  <RefreshCw className="w-3 h-3 mr-1" /> WebRTC
                </Button>
                {hlsUrl && (
                  <Button variant="outline" size="sm" onClick={switchToHls} className="text-[10px] h-7">
                    <Video className="w-3 h-3 mr-1" /> HLS
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top overlay: camera name + status + latency */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-2 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] bg-transparent border-none gap-1 px-1.5 py-0 text-white/90 font-mono">
              <div className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-500' : status === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-muted-foreground'}`} />
              {status === 'recording' ? 'REC' : 'LIVE'}
            </Badge>
            {compact && (
              <span className="text-[9px] font-mono text-white/70 truncate max-w-[120px]">{name}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {connectionStatus === 'connected' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`w-1.5 h-1.5 rounded-full ${latencyColors[latency]}`} />
                </TooltipTrigger>
                <TooltipContent>
                  Latência: {latency === 'good' ? 'Boa' : latency === 'fair' ? 'Regular' : 'Alta'}
                </TooltipContent>
              </Tooltip>
            )}
            <span className="text-[8px] font-mono text-white/40 uppercase">{streamMode === 'hls' ? 'HLS' : 'WebRTC'}</span>
          </div>
        </div>

        {/* Analytics overlay */}
        {showAnalytics && connectionStatus === 'connected' && (
          <AnalyticsOverlay cameraId={cameraId} compact={compact} />
        )}

        {/* Bottom controls - visible on hover */}
        {!compact && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={() => setPlaying(!playing)}>
                      {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{playing ? 'Pausar' : 'Reproduzir'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={() => setMuted(!muted)}>
                      {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{muted ? 'Ativar Som' : 'Silenciar'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={handleSnapshot}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Snapshot</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={handleManualReconnect}>
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reconectar</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={handleFullscreen}>
                      <Maximize2 className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Tela Cheia</TooltipContent>
                </Tooltip>

                {hlsUrl && streamMode !== 'hls' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-400/80 hover:text-amber-400 hover:bg-white/10" onClick={switchToHls}>
                        <Video className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Alternar para HLS</TooltipContent>
                  </Tooltip>
                )}
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
