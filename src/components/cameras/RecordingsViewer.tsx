import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Film, Play, Clock, HardDrive, Download, ChevronLeft, ChevronRight, Scissors } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  const s = seconds % 60;
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

const RecordingsViewer = ({ open, onOpenChange, camera }: RecordingsViewerProps) => {
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [cursorMinutes, setCursorMinutes] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !camera) return;
    const fetchRecordings = async () => {
      setLoading(true);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      if (isLocalInstallation()) {
        try {
          const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
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
  }, [open, camera, date]);

  const getSegments = () => {
    return recordings.map(rec => {
      const start = new Date(rec.start_time);
      const startMin = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60;
      const durationMin = (rec.duration_seconds || 0) / 60;
      const endMin = Math.min(startMin + durationMin, 1440);
      return { id: rec.id, startPct: (startMin / 1440) * 100, widthPct: ((endMin - startMin) / 1440) * 100, startMin, endMin };
    });
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
    if (seg) setPlayingId(seg.id);
  }, [recordings]);

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
    // Find recordings that overlap with the A-B range
    const segments = getSegments();
    const overlapping = segments.filter(s => s.endMin > pointA! && s.startMin < pointB!);
    if (overlapping.length === 0) {
      toast({ title: 'Nenhuma gravação no trecho selecionado', variant: 'destructive' });
      return;
    }
    // Download the first overlapping recording file
    const rec = recordings.find(r => r.id === overlapping[0].id);
    if (rec?.file_path) {
      window.open(rec.file_path, '_blank');
      toast({ title: `Baixando trecho ${minutesToTime(pointA)} → ${minutesToTime(pointB)}` });
    } else {
      toast({ title: 'Arquivo não disponível para download', variant: 'destructive' });
    }
  };

  const segments = getSegments();
  const cursorPct = (cursorMinutes / 1440) * 100;
  const pointAPct = pointA !== null ? (pointA / 1440) * 100 : null;
  const pointBPct = pointB !== null ? (pointB / 1440) * 100 : null;
  const selectionLeft = pointAPct !== null ? pointAPct : 0;
  const selectionWidth = pointAPct !== null && pointBPct !== null ? pointBPct - pointAPct : 0;

  const totalSize = recordings.reduce((acc, r) => acc + (Number(r.file_size_mb) || 0), 0);
  const totalDuration = recordings.reduce((acc, r) => acc + (r.duration_seconds || 0), 0);

  if (!camera) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            Gravações — {camera.name}
          </DialogTitle>
        </DialogHeader>

        {/* Date picker + stats */}
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-52 justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
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

          <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Film className="w-3.5 h-3.5" />{recordings.length} vídeos</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(totalDuration)}</span>
            <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" />{formatFileSize(totalSize)}</span>
          </div>
        </div>

        {/* Player area */}
        {playingId && (
          <div className="bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
            {(() => {
              const rec = recordings.find(r => r.id === playingId);
              if (!rec?.file_path) return <p className="text-muted-foreground text-sm">Arquivo não disponível</p>;
              const videoSrc = isLocalInstallation()
                ? `${getLocalApiBase()}/api/cameras/recording/file?path=${encodeURIComponent(rec.file_path)}`
                : rec.file_path;
              return <video src={videoSrc} controls autoPlay className="w-full h-full object-contain" />;
            })()}
          </div>
        )}

        {/* Timeline Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Linha do Tempo</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">
                {minutesToTime(cursorMinutes)} – {format(date, 'dd/MM/yyyy')}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    {format(date, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
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
            </div>
          </div>

          {/* Timeline container */}
          <div className="relative select-none">
            {/* Hour labels */}
            <div className="flex justify-between px-0 mb-0.5">
              {[0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => (
                <span key={h} className="text-[9px] font-mono text-muted-foreground w-0 text-center">
                  {String(h).padStart(2, '0')}:00
                </span>
              ))}
            </div>

            {/* Bar */}
            <div
              ref={timelineRef}
              className="relative h-10 bg-muted/80 rounded cursor-crosshair border border-border overflow-hidden"
              onClick={handleTimelineClick}
              onMouseDown={(e) => { handleTimelineClick(e); setIsDragging(true); }}
            >
              {/* Recording segments */}
              {segments.map(seg => (
                <div
                  key={seg.id}
                  className={cn(
                    "absolute top-0 bottom-0 transition-colors",
                    playingId === seg.id ? "bg-primary" : "bg-primary/50 hover:bg-primary/70"
                  )}
                  style={{ left: `${seg.startPct}%`, width: `${Math.max(seg.widthPct, 0.3)}%` }}
                />
              ))}

              {/* A-B selection highlight */}
              {pointAPct !== null && pointBPct !== null && (
                <div
                  className="absolute top-0 bottom-0 bg-primary/20 border-x-2 border-primary z-[5]"
                  style={{ left: `${selectionLeft}%`, width: `${selectionWidth}%` }}
                />
              )}

              {/* Point A marker */}
              {pointAPct !== null && (
                <div className="absolute top-0 bottom-0 z-[8] pointer-events-none" style={{ left: `${pointAPct}%` }}>
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary bg-card border border-primary rounded px-1">A</div>
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-primary" />
                </div>
              )}

              {/* Point B marker */}
              {pointBPct !== null && (
                <div className="absolute top-0 bottom-0 z-[8] pointer-events-none" style={{ left: `${pointBPct}%` }}>
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary bg-card border border-primary rounded px-1">B</div>
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-primary" />
                </div>
              )}

              {/* Cursor / playhead */}
              <div className="absolute top-0 bottom-0 w-0.5 z-10 pointer-events-none" style={{ left: `${cursorPct}%` }}>
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-3 h-2 bg-primary rounded-t-sm border border-primary" />
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-primary" />
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-2 bg-primary rounded-b-sm border border-primary" />
              </div>
            </div>

            {/* Navigation arrows */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-1" style={{ marginTop: '8px' }}>
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
            <Button
              variant={pointA !== null ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleSetPointA}
            >
              <span className="font-bold">A</span>
              {pointA !== null ? minutesToTime(pointA) : 'Ponto A'}
            </Button>
            <Button
              variant={pointB !== null ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleSetPointB}
            >
              <span className="font-bold">B</span>
              {pointB !== null ? minutesToTime(pointB) : 'Ponto B'}
            </Button>

            {pointA !== null && pointB !== null && (
              <>
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Scissors className="w-3 h-3" />
                  {formatDuration(Math.round((pointB - pointA) * 60))}
                </Badge>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleDownloadClip}
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Trecho
                </Button>
              </>
            )}

            {(pointA !== null || pointB !== null) && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleClearPoints}>
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Recordings table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell>
              </TableRow>
            ) : recordings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Nenhuma gravação encontrada para esta data
                </TableCell>
              </TableRow>
            ) : (
              recordings.map((rec) => (
                <TableRow
                  key={rec.id}
                  className={cn("cursor-pointer transition-colors", playingId === rec.id && "bg-primary/10")}
                  onClick={() => setPlayingId(rec.id === playingId ? null : rec.id)}
                >
                  <TableCell className="text-xs font-mono">{format(new Date(rec.start_time), 'HH:mm:ss')}</TableCell>
                  <TableCell className="text-xs font-mono">{rec.end_time ? format(new Date(rec.end_time), 'HH:mm:ss') : '—'}</TableCell>
                  <TableCell className="text-xs">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-muted-foreground" />{formatDuration(rec.duration_seconds || 0)}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-muted-foreground" />{formatFileSize(Number(rec.file_size_mb) || 0)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={rec.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                      {rec.status === 'completed' ? 'Completo' : rec.status === 'recording' ? 'Gravando' : rec.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setPlayingId(rec.id); }}>
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                      {rec.file_path && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                          e.stopPropagation();
                          const url = isLocalInstallation()
                            ? `${getLocalApiBase()}/api/cameras/recording/file?path=${encodeURIComponent(rec.file_path)}`
                            : rec.file_path;
                          window.open(url, '_blank');
                        }}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};

export default RecordingsViewer;
