import { useEffect, useRef, useState, useCallback } from 'react';
import { VideoOff, Loader2 } from 'lucide-react';

interface WebRtcPlayerProps {
  src: string; // WebRTC WHIP endpoint, e.g. http://server:8889/cam01/whip
  className?: string;
  muted?: boolean;
  autoPlay?: boolean;
}

const WebRtcPlayer = ({ src, className = '', muted = true, autoPlay = true }: WebRtcPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    const connect = async () => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        pc.ontrack = (evt) => {
          if (video.srcObject !== evt.streams[0]) {
            video.srcObject = evt.streams[0];
          }
        };

        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === 'connected') {
            setStatus('playing');
            if (autoPlay) video.play().catch(() => {});
          } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            setStatus('error');
          }
        };

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering to complete (or timeout)
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
            return;
          }
          const timeout = setTimeout(resolve, 2000);
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              resolve();
            }
          };
        });

        // Send offer to WHIP endpoint
        // If src already contains /whip, use as-is; otherwise append /whip
        const whipUrl = src.includes('/whip') ? src : `${src.replace(/\/$/, '')}/whip`;
        const resp = await fetch(whipUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription?.sdp,
        });

        if (!resp.ok) {
          console.error('WHIP error:', resp.status, await resp.text());
          setStatus('error');
          cleanup();
          return;
        }

        const answerSdp = await resp.text();
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'answer',
          sdp: answerSdp,
        }));
      } catch (err) {
        console.error('WebRTC connection error:', err);
        setStatus('error');
        cleanup();
      }
    };

    connect();

    return cleanup;
  }, [src, autoPlay, cleanup]);

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
        autoPlay={autoPlay}
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-camera-bg">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="text-xs font-mono text-muted-foreground ml-2">Conectando WebRTC...</span>
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

export default WebRtcPlayer;
