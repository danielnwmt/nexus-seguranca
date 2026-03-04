import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Film, CalendarIcon, Clock, HardDrive, Play, Search, Camera, Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';
import { useTableQuery } from '@/hooks/useSupabaseQuery';
import { useToast } from '@/hooks/use-toast';
import RecordingsViewer from '@/components/cameras/RecordingsViewer';

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatFileSize = (mb: number) => {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
};

const Recordings = () => {
  const { toast } = useToast();
  const { data: cameras = [] } = useTableQuery('cameras');
  const { data: clients = [] } = useTableQuery('clients');

  const [date, setDate] = useState<Date>(new Date());
  const [selectedCameraId, setSelectedCameraId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingRecording, setPlayingRecording] = useState<any | null>(null);
  const [viewerCamera, setViewerCamera] = useState<{ id: string; name: string; clientName?: string } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
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

          let url = `${getLocalApiBase()}/rest/v1/recordings?select=*&and=(start_time.gte.${startOfDay.toISOString()},start_time.lte.${endOfDay.toISOString()})&order=start_time.desc`;
          if (selectedCameraId !== 'all') {
            url += `&camera_id=eq.${selectedCameraId}`;
          }
          const res = await fetch(url, { headers });
          setRecordings(res.ok ? await res.json() : []);
        } catch {
          setRecordings([]);
        }
      } else {
        let query = supabase
          .from('recordings')
          .select('*')
          .gte('start_time', startOfDay.toISOString())
          .lte('start_time', endOfDay.toISOString())
          .order('start_time', { ascending: false });

        if (selectedCameraId !== 'all') {
          query = query.eq('camera_id', selectedCameraId);
        }

        const { data } = await query;
        setRecordings(data || []);
      }
      setLoading(false);
    };
    fetchRecordings();
  }, [date, selectedCameraId]);

  const filteredRecordings = search
    ? recordings.filter(r =>
        (r.camera_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.client_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : recordings;

  const totalSize = filteredRecordings.reduce((acc, r) => acc + (Number(r.file_size_mb) || 0), 0);
  const totalDuration = filteredRecordings.reduce((acc, r) => acc + (r.duration_seconds || 0), 0);

  const handleOpenTimeline = (rec: any) => {
    setViewerCamera({ id: rec.camera_id, name: rec.camera_name || 'Câmera', clientName: rec.client_name });
    setViewerOpen(true);
  };

  // Group cameras by client for the sidebar
  const camerasByClient = (cameras as any[]).reduce((acc: Record<string, any[]>, cam: any) => {
    const client = (clients as any[]).find(c => c.id === cam.client_id);
    const clientName = client?.name || 'Sem Cliente';
    if (!acc[clientName]) acc[clientName] = [];
    acc[clientName].push(cam);
    return acc;
  }, {});

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar - Filtros */}
      <aside className="w-64 shrink-0 space-y-4">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filtros
          </h3>

          {/* Date filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left text-xs">
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

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar câmera..."
              className="pl-8 text-xs h-8 bg-muted border-border"
            />
          </div>
        </div>

        {/* Camera list grouped by client */}
        <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin">
          <button
            onClick={() => setSelectedCameraId('all')}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors",
              selectedCameraId === 'all' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Camera className="w-3.5 h-3.5 inline mr-1.5" />
            Todas as Câmeras
          </button>

          {Object.entries(camerasByClient).map(([clientName, cams]) => (
            <div key={clientName}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">{clientName}</p>
              {(cams as any[]).map((cam: any) => (
                <button
                  key={cam.id}
                  onClick={() => setSelectedCameraId(cam.id)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors",
                    selectedCameraId === cam.id ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-muted"
                  )}
                >
                  <Camera className="w-3 h-3 inline mr-1.5 opacity-60" />
                  {cam.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 space-y-4 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gravações</h1>
            <p className="text-sm text-muted-foreground font-mono">Galeria de vídeos salvos</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Film className="w-3.5 h-3.5" />{filteredRecordings.length} vídeos</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(totalDuration)}</span>
            <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" />{formatFileSize(totalSize)}</span>
          </div>
        </div>

        {/* Recordings grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <Film className="w-8 h-8" />
              <span className="text-sm">Carregando gravações...</span>
            </div>
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Film className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Nenhuma gravação encontrada</p>
            <p className="text-xs">Selecione outra data ou câmera</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredRecordings.map((rec) => (
              <Card
                key={rec.id}
                className={cn(
                  "group cursor-pointer overflow-hidden transition-all hover:border-primary/40 hover:shadow-md",
                  playingRecording?.id === rec.id && "border-primary ring-1 ring-primary/30"
                )}
                onClick={() => handleOpenTimeline(rec)}
              >
                {/* Thumbnail / Preview */}
                <div className="relative bg-muted aspect-video flex items-center justify-center">
                  <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--primary) / 0.05) 2px, hsl(var(--primary) / 0.05) 4px)',
                  }} />
                  <Film className="w-8 h-8 text-primary/20" />

                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/40 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100">
                      <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                    </div>
                  </div>

                  {/* Duration badge */}
                  <Badge className="absolute bottom-1.5 right-1.5 text-[10px] px-1.5 py-0 h-5 bg-background/80 text-foreground border-0">
                    {formatDuration(rec.duration_seconds || 0)}
                  </Badge>

                  {/* Status */}
                  {rec.status === 'recording' && (
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-destructive pulse-alarm" />
                      <span className="text-[9px] font-mono text-destructive font-bold">REC</span>
                    </div>
                  )}
                </div>

                <CardContent className="p-2.5 space-y-1">
                  <p className="text-xs font-medium text-foreground truncate">{rec.camera_name || 'Câmera'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{rec.client_name || '—'}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>{format(new Date(rec.start_time), 'HH:mm:ss')}</span>
                    <span>{formatFileSize(Number(rec.file_size_mb) || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Timeline viewer dialog */}
      <RecordingsViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        camera={viewerCamera}
      />
    </div>
  );
};

export default Recordings;
