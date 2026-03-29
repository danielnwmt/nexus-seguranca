import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Film, Play, Pause, Clock, HardDrive, Download, ChevronLeft, ChevronRight, Scissors, SkipForward, SkipBack, Volume2, VolumeX } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';
import { useToast } from '@/hooks/use-toast';

interface RecordingsViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camera: { id: string; name: string; clientName?: string } | null;
}

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatFileSize = (mb: number) => {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
};

const minutesToTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  const s = Math.floor((mins % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

type Segment = {
  id: string;
  startPct: number;
  widthPct: number;
  startMin: number;
  endMin: number;
};

const RecordingsViewer = ({ open, onOpenChange, camera }: RecordingsViewerProps) => {
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [cursorMinutes, setCursorMinutes] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const [autoDateDone, setAutoDateDone] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);

  // Find the most recent date with recordings on open
  useEffect(() => {
    if (!open || !camera) {
      setAutoDateDone(false);
      setPlayingId(null);
      setIsPlaying(false);
      return;
    }
    const findLatestDate = async () => {
      if (isLocalInstallation()) {
        try {
          const session = JSON.parse(sessionStorage.getItem('nexus-local-session') || localStorage.getItem('nexus-local-session') || '{}');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
          const url = `${getLocalApiBase()}/rest/v1/recordings?select=start_time&camera_id=eq.${camera.id}&order=start_time.desc&limit=1`;
          const res = await fetch(url, { headers });
          if (res.ok) {
            const rows = await res.json();
            if (rows.length > 0) setDate(new Date(rows[0].start_time));
          }
        } catch {}
      } else {
        const { data } = await supabase
          .from('recordings')
          .select('start_time')
          .eq('camera_id', camera.id)
          .order('start_time', { ascending: false })
          .limit(1);
        if (data && data.length > 0) setDate(new Date(data[0].start_time));
      }
      setAutoDateDone(true);
    };
    findLatestDate();
  }, [open, camera]);

  // Fetch recordings for the selected date
  useEffect(() => {
    if (!open || !camera || !autoDateDone) return;
    const fetchRecordings = async () => {
      setLoading(true);
      setPlayingId(null);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      if (isLocalInstallation()) {
        try {
          const session = JSON.parse(sessionStorage.getItem('nexus-local-session') || localStorage.getItem('nexus-local-session') || '{}');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
          const url = `${getLocalApiBase()}/rest/v1/recordings?select=*&camera_id=eq.${camera.id}&and=(start_time.gte.${startOfDay.toISOString()},start_time.lte.${endOfDay.toISOString()})&order=start_time.asc`;
          const res = await fetch(url, { headers });
          setRecordings(res.ok ? await res.json() : []);
        } catch {
          setRecordings([]);
        }
      } else {
        const { data } = await supabase
          .from('recordings')
          .select('*')
          .eq('camera_id', camera.id)
          .gte('start_time', startOfDay.toISOString())
          .lte('start_time', endOfDay.toISOString())
          .order('start_time', { ascending: true });
        setRecordings(data || []);
      }
      setLoading(false);
    };
    fetchRecordings();
  }, [open, camera, date, autoDateDone]);

  // Auto-play first recording when recordings load
  useEffect(() => {
    if (recordings.length > 0 && !playingId) {
      setPlayingId(recordings[0].id);
      const start = new Date(recordings[0].start_time);
      setCursorMinutes(start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60);
    }
  }, [recordings]);

  const getSegments = useCallback((): Segment[] => {
    return recordings.map(rec => {
      const start = new Date(rec.start_time);
      const startMin = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60;
      const durationMin = (rec.duration_seconds || 0) / 60;
      const endMin = Math.min(startMin + durationMin, 1440);
      return { id: rec.id, startPct: (startMin / 1440) * 100, widthPct: ((endMin - startMin) / 1440) * 100, startMin, endMin };
    });
  }, [recordings]);

  // Sync timeline cursor with video playback position
  const syncCursorWithVideo = useCallback(() => {
    if (!videoRef.current || !playingId) return;
    const rec = recordings.find(r => r.id === playingId);
    if (!rec) return;
    const start = new Date(rec.start_time);
    const startMin = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60;
    const currentTime = videoRef.current.currentTime;
    const currentMin = startMin + currentTime / 60;
    setCursorMinutes(currentMin);
    setVideoProgress(videoRef.current.duration > 0 ? (currentTime / videoRef.current.duration) * 100 : 0);

    if (!videoRef.current.paused) {
      animFrameRef.current = requestAnimationFrame(syncCursorWithVideo);
    }
  }, [playingId, recordings]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Handle video events
  const handleVideoPlay = () => {
    setIsPlaying(true);
    animFrameRef.current = requestAnimationFrame(syncCursorWithVideo);
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };

  // Auto-advance to next recording when current one ends (DVR continuous playback)
  const handleVideoEnded = () => {
    const currentIndex = recordings.findIndex(r => r.id === playingId);
    if (currentIndex >= 0 && currentIndex < recordings.length - 1) {
      const nextRec = recordings[currentIndex + 1];
      setPlayingId(nextRec.id);
      const start = new Date(nextRec.start_time);
      setCursorMinutes(start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60);
    } else {
      setIsPlaying(false);
    }
  };

  const skipToRecording = (direction: 'prev' | 'next') => {
    const currentIndex = recordings.findIndex(r => r.id === playingId);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < recordings.length) {
      const rec = recordings[newIndex];
      setPlayingId(rec.id);
      const start = new Date(rec.start_time);
      setCursorMinutes(start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60);
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  };

  const cycleSpeed = () => {
    const speeds = [1, 2, 4, 8, 16];
    const idx = speeds.indexOf(playbackSpeed);
    const next = speeds[(idx + 1) % speeds.length];
    setPlaybackSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };

  const getMinutesFromEvent = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min((e as MouseEvent).clientX - rect.left, rect.width));
    return (x / rect.width) * 1440;
  }, []);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const mins = getMinutesFromEvent(e);
    setCursorMinutes(mins);
    const segments = getSegments();
    const seg = segments.find(s => mins >= s.startMin && mins <= s.endMin);
    if (seg) {
      const rec = recordings.find(r => r.id === seg.id);
      if (rec) {
        const start = new Date(rec.start_time);
        const startMin = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60;
        const offsetSeconds = (mins - startMin) * 60;
        
        if (playingId === seg.id && videoRef.current) {
          // Seek within current video
          videoRef.current.currentTime = Math.max(0, offsetSeconds);
        } else {
          // Switch to this recording and seek
          setPlayingId(seg.id);
          // We'll seek after video loads via onLoadedMetadata
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.currentTime = Math.max(0, offsetSeconds);
            }
          }, 300);
        }
      }
    }
  }, [recordings, playingId, getSegments]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setCursorMinutes((x / rect.width) * 1440);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const nudgeCursor = (dir: number) => {
    setCursorMinutes(prev => Math.max(0, Math.min(1440, prev + dir * 5)));
  };

  const handleSetPointA = () => {
    setPointA(cursorMinutes);
    if (pointB !== null && cursorMinutes >= pointB) setPointB(null);
  };

  const handleSetPointB = () => {
    if (pointA === null) {
      toast({ title: 'Defina o Ponto A primeiro', variant: 'destructive' });
      return;
    }
    if (cursorMinutes <= pointA) {
      toast({ title: 'Ponto B deve ser após o Ponto A', variant: 'destructive' });
      return;
    }
    setPointB(cursorMinutes);
  };

  const handleClearPoints = () => {
    setPointA(null);
    setPointB(null);
  };

  const handleDownloadClip = () => {
    if (pointA === null || pointB === null) return;
    const segments = getSegments();
    const overlapping = segments.filter(s => s.endMin > pointA! && s.startMin < pointB!);
    if (overlapping.length === 0) {
      toast({ title: 'Nenhuma gravação no trecho selecionado', variant: 'destructive' });
      return;
    }
    const rec = recordings.find(r => r.id === overlapping[0].id);
    if (rec?.file_path) {
      let url: string;
      if (isLocalInstallation()) {
        const session = JSON.parse(sessionStorage.getItem('nexus-local-session') || localStorage.getItem('nexus-local-session') || '{}');
        const token = session.access_token || '';
        url = `${getLocalApiBase()}/api/cameras/recording/file?path=${encodeURIComponent(rec.file_path)}&token=${encodeURIComponent(token)}`;
      } else {
        url = rec.file_path;
      }
      window.open(url, '_blank');
      toast({ title: `Baixando trecho ${minutesToTime(pointA)} → ${minutesToTime(pointB)}` });
    } else {
      toast({ title: 'Arquivo não disponível para download', variant: 'destructive' });
    }
  };

  const getVideoSrc = (rec: any) => {
    if (!rec?.file_path) return '';
    if (isLocalInstallation()) {
      const session = JSON.parse(sessionStorage.getItem('nexus-local-session') || localStorage.getItem('nexus-local-session') || '{}');
      const token = session.access_token || '';
      return `${getLocalApiBase()}/api/cameras/recording/file?path=${encodeURIComponent(rec.file_path)}&token=${encodeURIComponent(token)}`;
    }
    return rec.file_path;
  };

  const segments = getSegments();
  const cursorPct = (cursorMinutes / 1440) * 100;
  const pointAPct = pointA !== null ? (pointA / 1440) * 100 : null;
  const pointBPct = pointB !== null ? (pointB / 1440) * 100 : null;
  const selectionLeft = pointAPct !== null ? pointAPct : 0;
  const selectionWidth = pointAPct !== null && pointBPct !== null ? pointBPct - pointAPct : 0;

  const totalSize = recordings.reduce((acc, r) => acc + (Number(r.file_size_mb) || 0), 0);
  const totalDuration = recordings.reduce((acc, r) => acc + (r.duration_seconds || 0), 0);

  const currentRecIndex = recordings.findIndex(r => r.id === playingId);
  const currentRec = currentRecIndex >= 0 ? recordings[currentRecIndex] : null;

  if (!camera) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-6xl max-h-[95vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              <span>Gravações — {camera.name}</span>
              {camera.clientName && <span className="text-xs text-muted-foreground font-normal ml-1">({camera.clientName})</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Film className="w-3.5 h-3.5" />{recordings.length} vídeos</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(totalDuration)}</span>
            <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" />{formatFileSize(totalSize)}</span>
          </div>
        </div>

        <div className="px-6 pb-5 space-y-3">
          {/* Video Player - DVR style */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video group">
            {playingId && currentRec ? (
              <>
                <video
                  ref={videoRef}
                  key={playingId}
                  src={getVideoSrc(currentRec)}
                  className="w-full h-full object-contain"
                  autoPlay
                  muted={isMuted}
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                  onEnded={handleVideoEnded}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      videoRef.current.playbackRate = playbackSpeed;
                    }
                  }}
                />
                {/* DVR overlay controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-3 px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {/* Current time info */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary/90 text-primary-foreground text-[10px] h-5">
                        {minutesToTime(cursorMinutes)}
                      </Badge>
                      <span className="text-[10px] text-white/60">
                        {currentRec.camera_name} • {format(date, 'dd/MM/yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {playbackSpeed > 1 && (
                        <Badge className="bg-destructive/80 text-destructive-foreground text-[10px] h-5 animate-pulse">
                          {playbackSpeed}x
                        </Badge>
                      )}
                      <span className="text-[10px] text-white/60">
                        {currentRecIndex + 1}/{recordings.length}
                      </span>
                    </div>
                  </div>
                  {/* Transport controls */}
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={() => skipToRecording('prev')}
                      disabled={currentRecIndex <= 0}
                    >
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-white hover:bg-white/20 rounded-full border border-white/30"
                      onClick={togglePlayPause}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={() => skipToRecording('next')}
                      disabled={currentRecIndex >= recordings.length - 1}
                    >
                      <SkipForward className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-white/20 mx-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={toggleMute}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-white hover:bg-white/20 text-xs font-mono"
                      onClick={cycleSpeed}
                    >
                      {playbackSpeed}x
                    </Button>
                  </div>
                </div>
                {/* REC indicator */}
                {currentRec.status === 'recording' && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded">
                    <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    <span className="text-[10px] font-mono text-destructive font-bold">REC</span>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40">
                <Film className="w-16 h-16 mb-2" />
                <p className="text-sm">{loading ? 'Carregando...' : 'Selecione uma gravação'}</p>
              </div>
            )}
          </div>

          {/* Date picker row */}
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-52 justify-start text-left font-normal text-xs")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {format(date, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={(d) => d > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <div className="flex-1" />
            <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
              {minutesToTime(cursorMinutes)} – {format(date, 'dd/MM/yyyy')}
            </span>
          </div>

          {/* Timeline Bar - DVR style */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Linha do Tempo (24h)</span>
            </div>

            <div className="relative select-none">
              {/* Hour labels */}
              <div className="flex justify-between px-0 mb-0.5">
                {[0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => (
                  <span key={h} className="text-[8px] font-mono text-muted-foreground/60 w-0 text-center">
                    {String(h).padStart(2, '0')}:00
                  </span>
                ))}
              </div>

              {/* Bar */}
              <div
                ref={timelineRef}
                className="relative h-12 bg-muted/60 rounded-md cursor-crosshair border border-border/50 overflow-hidden"
                onClick={handleTimelineClick}
                onMouseDown={(e) => { handleTimelineClick(e); setIsDragging(true); }}
              >
                {/* Hour grid lines */}
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-border/30"
                    style={{ left: `${(i / 24) * 100}%` }}
                  />
                ))}

                {/* Recording segments */}
                {segments.map(seg => (
                  <div
                    key={seg.id}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-sm transition-all",
                      playingId === seg.id
                        ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                        : "bg-primary/40 hover:bg-primary/60"
                    )}
                    style={{ left: `${seg.startPct}%`, width: `${Math.max(seg.widthPct, 0.3)}%` }}
                  />
                ))}

                {/* A-B selection highlight */}
                {pointAPct !== null && pointBPct !== null && (
                  <div
                    className="absolute top-0 bottom-0 bg-primary/15 border-x-2 border-primary/60 z-[5]"
                    style={{ left: `${selectionLeft}%`, width: `${selectionWidth}%` }}
                  />
                )}

                {/* Point A marker */}
                {pointAPct !== null && (
                  <div className="absolute top-0 bottom-0 z-[8] pointer-events-none" style={{ left: `${pointAPct}%` }}>
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-primary bg-card border border-primary rounded px-1">A</div>
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-primary" />
                  </div>
                )}

                {/* Point B marker */}
                {pointBPct !== null && (
                  <div className="absolute top-0 bottom-0 z-[8] pointer-events-none" style={{ left: `${pointBPct}%` }}>
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-primary bg-card border border-primary rounded px-1">B</div>
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-primary" />
                  </div>
                )}

                {/* Cursor / playhead */}
                <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `${cursorPct}%` }}>
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-primary" />
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-primary shadow-[0_0_4px_hsl(var(--primary)/0.8)]" />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent border-b-primary" />
                </div>
              </div>

              {/* Navigation arrows */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-0.5" style={{ marginTop: '8px' }}>
                <button
                  className="pointer-events-auto w-5 h-5 rounded bg-background/80 border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  onClick={(e) => { e.stopPropagation(); nudgeCursor(-1); }}
                >
                  <ChevronLeft className="w-3 h-3 text-primary" />
                </button>
                <button
                  className="pointer-events-auto w-5 h-5 rounded bg-background/80 border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  onClick={(e) => { e.stopPropagation(); nudgeCursor(1); }}
                >
                  <ChevronRight className="w-3 h-3 text-primary" />
                </button>
              </div>
            </div>

            {/* A-B Controls */}
            <div className="flex items-center gap-2 pt-1">
              <Button variant={pointA !== null ? 'default' : 'outline'} size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={handleSetPointA}>
                <span className="font-bold">A</span>
                {pointA !== null ? minutesToTime(pointA) : 'Ponto A'}
              </Button>
              <Button variant={pointB !== null ? 'default' : 'outline'} size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={handleSetPointB}>
                <span className="font-bold">B</span>
                {pointB !== null ? minutesToTime(pointB) : 'Ponto B'}
              </Button>

              {pointA !== null && pointB !== null && (
                <>
                  <Badge variant="secondary" className="text-[10px] gap-1 h-6">
                    <Scissors className="w-3 h-3" />
                    {formatDuration(Math.round((pointB - pointA) * 60))}
                  </Badge>
                  <Button size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={handleDownloadClip}>
                    <Download className="w-3 h-3" />
                    Baixar Trecho
                  </Button>
                </>
              )}

              {(pointA !== null || pointB !== null) && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground px-2" onClick={handleClearPoints}>
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Recordings list - compact */}
          <div className="max-h-[200px] overflow-y-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="text-[10px]">
                  <TableHead className="py-1.5 h-auto">Início</TableHead>
                  <TableHead className="py-1.5 h-auto">Fim</TableHead>
                  <TableHead className="py-1.5 h-auto">Duração</TableHead>
                  <TableHead className="py-1.5 h-auto">Tamanho</TableHead>
                  <TableHead className="py-1.5 h-auto">Status</TableHead>
                  <TableHead className="py-1.5 h-auto w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs">Carregando...</TableCell>
                  </TableRow>
                ) : recordings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      <Film className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Nenhuma gravação encontrada</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  recordings.map((rec) => (
                    <TableRow
                      key={rec.id}
                      className={cn(
                        "cursor-pointer transition-colors text-xs",
                        playingId === rec.id && "bg-primary/10 border-l-2 border-l-primary"
                      )}
                      onClick={() => {
                        setPlayingId(rec.id);
                        const start = new Date(rec.start_time);
                        setCursorMinutes(start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60);
                      }}
                    >
                      <TableCell className="text-[11px] font-mono py-1.5">{format(new Date(rec.start_time), 'HH:mm:ss')}</TableCell>
                      <TableCell className="text-[11px] font-mono py-1.5">{rec.end_time ? format(new Date(rec.end_time), 'HH:mm:ss') : '—'}</TableCell>
                      <TableCell className="text-[11px] py-1.5">{formatDuration(rec.duration_seconds || 0)}</TableCell>
                      <TableCell className="text-[11px] py-1.5">{formatFileSize(Number(rec.file_size_mb) || 0)}</TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant={rec.status === 'completed' ? 'default' : 'secondary'} className="text-[9px] h-4 px-1.5">
                          {rec.status === 'completed' ? 'OK' : rec.status === 'recording' ? 'REC' : rec.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setPlayingId(rec.id); }}>
                            <Play className="w-3 h-3" />
                          </Button>
                          {rec.file_path && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {
                              e.stopPropagation();
                              window.open(getVideoSrc(rec), '_blank');
                            }}>
                              <Download className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecordingsViewer;
