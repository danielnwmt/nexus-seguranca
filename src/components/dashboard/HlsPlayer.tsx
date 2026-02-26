import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { VideoOff, Loader2 } from 'lucide-react';

interface HlsPlayerProps {
  src: string;
  className?: string;
  muted?: boolean;
  autoPlay?: boolean;
}

const HlsPlayer = ({ src, className = '', muted = true, autoPlay = true }: HlsPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      setStatus('error');
      return;
    }

    const destroy = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    // If the src is a direct HLS URL (.m3u8)
    if (src.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 6,
          liveDurationInfinity: true,
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
        });

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStatus('playing');
          if (autoPlay) video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setStatus('error');
                destroy();
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = src;
        video.addEventListener('loadedmetadata', () => {
          setStatus('playing');
          if (autoPlay) video.play().catch(() => {});
        });
        video.addEventListener('error', () => setStatus('error'));
      } else {
        setStatus('error');
      }
    } else {
      // For non-HLS URLs, try direct playback
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        setStatus('playing');
        if (autoPlay) video.play().catch(() => {});
      });
      video.addEventListener('error', () => setStatus('error'));
    }

    return destroy;
  }, [src, autoPlay]);

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-camera-bg ${className}`}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <VideoOff className="w-8 h-8" />
          <span className="text-xs font-mono">SEM URL</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted={muted}
        playsInline
        controls={false}
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-camera-bg">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="text-xs font-mono text-muted-foreground ml-2">Conectando...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-camera-bg">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <VideoOff className="w-8 h-8" />
            <span className="text-xs font-mono">FALHA NA CONEXÃO</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HlsPlayer;
