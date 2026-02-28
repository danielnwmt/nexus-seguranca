import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Film, Play, Clock, HardDrive, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface RecordingsViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camera: { id: string; name: string; clientName?: string } | null;
}

const VIDEO_SIZES = [
  { label: 'Todos', value: 'all' },
  { label: '< 100 MB', value: 'small' },
  { label: '100 - 500 MB', value: 'medium' },
  { label: '500 MB - 1 GB', value: 'large' },
  { label: '> 1 GB', value: 'xlarge' },
];

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

const RecordingsViewer = ({ open, onOpenChange, camera }: RecordingsViewerProps) => {
  const [date, setDate] = useState<Date>(new Date());
  const [sizeFilter, setSizeFilter] = useState('all');
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !camera) return;
    const fetchRecordings = async () => {
      setLoading(true);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      let query = supabase
        .from('recordings')
        .select('*')
        .eq('camera_id', camera.id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: false });

      const { data } = await query;
      setRecordings(data || []);
      setLoading(false);
    };
    fetchRecordings();
  }, [open, camera, date]);

  const filteredRecordings = recordings.filter(r => {
    if (sizeFilter === 'all') return true;
    const mb = Number(r.file_size_mb) || 0;
    if (sizeFilter === 'small') return mb < 100;
    if (sizeFilter === 'medium') return mb >= 100 && mb < 500;
    if (sizeFilter === 'large') return mb >= 500 && mb < 1024;
    if (sizeFilter === 'xlarge') return mb >= 1024;
    return true;
  });

  const totalSize = filteredRecordings.reduce((acc, r) => acc + (Number(r.file_size_mb) || 0), 0);
  const totalDuration = filteredRecordings.reduce((acc, r) => acc + (r.duration_seconds || 0), 0);

  if (!camera) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            Gravações — {camera.name}
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
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

          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger className="w-44 bg-muted border-border">
              <HardDrive className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Tamanho" />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_SIZES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Film className="w-3.5 h-3.5" />
              {filteredRecordings.length} vídeos
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(totalDuration)}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" />
              {formatFileSize(totalSize)}
            </span>
          </div>
        </div>

        {/* Player area */}
        {playingId && (
          <div className="bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
            {(() => {
              const rec = recordings.find(r => r.id === playingId);
              if (!rec?.file_path) return <p className="text-muted-foreground text-sm">Arquivo não disponível</p>;
              return (
                <video
                  src={rec.file_path}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              );
            })()}
          </div>
        )}

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
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredRecordings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Nenhuma gravação encontrada para esta data
                </TableCell>
              </TableRow>
            ) : (
              filteredRecordings.map((rec) => (
                <TableRow
                  key={rec.id}
                  className={cn("cursor-pointer transition-colors", playingId === rec.id && "bg-primary/10")}
                  onClick={() => setPlayingId(rec.id === playingId ? null : rec.id)}
                >
                  <TableCell className="text-xs font-mono">
                    {format(new Date(rec.start_time), 'HH:mm:ss')}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {rec.end_time ? format(new Date(rec.end_time), 'HH:mm:ss') : '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      {formatDuration(rec.duration_seconds || 0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-muted-foreground" />
                      {formatFileSize(Number(rec.file_size_mb) || 0)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={rec.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                      {rec.status === 'completed' ? 'Completo' : rec.status === 'recording' ? 'Gravando' : rec.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); setPlayingId(rec.id); }}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                      {rec.file_path && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(rec.file_path, '_blank');
                          }}
                        >
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
