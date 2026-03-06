import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, MousePointer, ArrowRight, RotateCcw } from 'lucide-react';

export interface LineCrossingLine {
  id: string;
  name: string;
  x1: number; // 0-1 normalized
  y1: number;
  x2: number;
  y2: number;
  direction: 'both' | 'left_to_right' | 'right_to_left';
  color: string;
}

interface LineCrossingEditorProps {
  lines: LineCrossingLine[];
  onChange: (lines: LineCrossingLine[]) => void;
  snapshotUrl?: string;
}

const LINE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

type DragState =
  | { type: 'none' }
  | { type: 'drawing'; start: { x: number; y: number }; current: { x: number; y: number } }
  | { type: 'dragging'; lineId: string; endpoint: 'start' | 'end' };

const LineCrossingEditor = ({ lines, onChange, snapshotUrl }: LineCrossingEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({ type: 'none' });
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState>({ type: 'none' });

  // Keep ref in sync for use in event handlers
  dragRef.current = dragState;

  useEffect(() => {
    if (snapshotUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setBgImage(img);
      img.src = snapshotUrl;
    }
  }, [snapshotUrl]);

  const getNormalizedCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  const findEndpointNear = useCallback((coords: { x: number; y: number }): { lineId: string; endpoint: 'start' | 'end' } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const w = canvas.width;
    const h = canvas.height;
    const threshold = 14;

    for (const line of lines) {
      const d1 = Math.hypot((line.x1 - coords.x) * w, (line.y1 - coords.y) * h);
      if (d1 < threshold) return { lineId: line.id, endpoint: 'start' };
      const d2 = Math.hypot((line.x2 - coords.x) * w, (line.y2 - coords.y) * h);
      if (d2 < threshold) return { lineId: line.id, endpoint: 'end' };
    }
    return null;
  }, [lines]);

  // ---- Drawing ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = 'hsl(220, 20%, 10%)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'hsl(220, 15%, 16%)';
      ctx.lineWidth = 1;
      const step = 30;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.fillStyle = 'hsl(220, 10%, 40%)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sem snapshot — desenhe as linhas sobre a grade', w / 2, h / 2);
    }

    // Saved lines
    for (const line of lines) {
      const isSelected = line.id === selectedLine;
      const lw = isSelected ? 4 : 3;
      const px1 = line.x1 * w, py1 = line.y1 * h;
      const px2 = line.x2 * w, py2 = line.y2 * h;

      // Glow for selected
      if (isSelected) {
        ctx.shadowColor = line.color;
        ctx.shadowBlur = 10;
      }

      // Line
      ctx.strokeStyle = line.color;
      ctx.lineWidth = lw;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Endpoints with labels A/B
      const endpoints = [
        { x: px1, y: py1, label: 'A' },
        { x: px2, y: py2, label: 'B' },
      ];
      for (const pt of endpoints) {
        const r = isSelected ? 8 : 6;
        ctx.fillStyle = line.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${isSelected ? 10 : 9}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pt.label, pt.x, pt.y);
      }

      // Direction arrow at midpoint
      const mx = (px1 + px2) / 2;
      const my = (py1 + py2) / 2;

      if (line.direction !== 'both') {
        const angle = Math.atan2(py2 - py1, px2 - px1);
        const perpAngle = line.direction === 'left_to_right' ? angle + Math.PI / 2 : angle - Math.PI / 2;
        const arrowLen = 20;
        const ax = mx + Math.cos(perpAngle) * arrowLen;
        const ay = my + Math.sin(perpAngle) * arrowLen;

        ctx.strokeStyle = line.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(ax, ay);
        ctx.stroke();

        // Arrowhead
        const headLen = 8;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - headLen * Math.cos(perpAngle - 0.5), ay - headLen * Math.sin(perpAngle - 0.5));
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - headLen * Math.cos(perpAngle + 0.5), ay - headLen * Math.sin(perpAngle + 0.5));
        ctx.stroke();
      }

      // Name label with background
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const labelWidth = ctx.measureText(line.name).width + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.beginPath();
      ctx.roundRect(mx - labelWidth / 2, my - 26, labelWidth, 16, 3);
      ctx.fill();
      ctx.fillStyle = line.color;
      ctx.fillText(line.name, mx, my - 12);
    }

    // Drawing preview
    const state = dragRef.current;
    if (state.type === 'drawing') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(state.start.x * w, state.start.y * h);
      ctx.lineTo(state.current.x * w, state.current.y * h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Start dot
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(state.start.x * w, state.start.y * h, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // End dot
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(state.current.x * w, state.current.y * h, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [lines, selectedLine, bgImage, dragState]);

  useEffect(() => { draw(); }, [draw]);

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = Math.round(container.clientWidth * 9 / 16);
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getNormalizedCoords(e);

    // Check if clicking near an endpoint to drag it
    const hit = findEndpointNear(coords);
    if (hit) {
      setSelectedLine(hit.lineId);
      setDragState({ type: 'dragging', lineId: hit.lineId, endpoint: hit.endpoint });
      return;
    }

    // Start drawing new line
    setSelectedLine(null);
    setDragState({ type: 'drawing', start: coords, current: coords });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getNormalizedCoords(e);
    const state = dragRef.current;

    if (state.type === 'drawing') {
      setDragState({ ...state, current: coords });
    } else if (state.type === 'dragging') {
      // Move the endpoint
      const updates = state.endpoint === 'start'
        ? { x1: coords.x, y1: coords.y }
        : { x2: coords.x, y2: coords.y };
      onChange(lines.map(l => l.id === state.lineId ? { ...l, ...updates } : l));
    } else {
      // Change cursor if hovering near an endpoint
      const canvas = canvasRef.current;
      if (canvas) {
        const hit = findEndpointNear(coords);
        canvas.style.cursor = hit ? 'grab' : 'crosshair';
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = dragRef.current;

    if (state.type === 'drawing') {
      const end = getNormalizedCoords(e);
      const canvas = canvasRef.current;
      const minDist = canvas
        ? Math.hypot((end.x - state.start.x) * canvas.width, (end.y - state.start.y) * canvas.height)
        : 0;

      if (minDist >= 25) {
        const colorIdx = lines.length % LINE_COLORS.length;
        const newLine: LineCrossingLine = {
          id: crypto.randomUUID(),
          name: `Linha ${lines.length + 1}`,
          x1: state.start.x,
          y1: state.start.y,
          x2: end.x,
          y2: end.y,
          direction: 'both',
          color: LINE_COLORS[colorIdx],
        };
        onChange([...lines, newLine]);
        setSelectedLine(newLine.id);
      }
    }

    setDragState({ type: 'none' });
  };

  const deleteLine = (id: string) => {
    onChange(lines.filter(l => l.id !== id));
    if (selectedLine === id) setSelectedLine(null);
  };

  const updateLine = (id: string, updates: Partial<LineCrossingLine>) => {
    onChange(lines.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const cycleDirection = (line: LineCrossingLine) => {
    const dirs: LineCrossingLine['direction'][] = ['both', 'left_to_right', 'right_to_left'];
    const idx = dirs.indexOf(line.direction);
    updateLine(line.id, { direction: dirs[(idx + 1) % dirs.length] });
  };

  const directionLabels: Record<string, string> = {
    both: '↔ Ambos',
    left_to_right: 'A → B',
    right_to_left: 'B → A',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <MousePointer className="w-3 h-3" />
          Clique e arraste para traçar linhas · Arraste os pontos A/B para reposicionar
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{lines.length} linha(s)</Badge>
          {lines.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
              onClick={() => { onChange([]); setSelectedLine(null); }}
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
      </div>

      <div ref={containerRef} className="relative rounded-lg overflow-hidden border border-border shadow-sm">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (dragRef.current.type !== 'none') {
              setDragState({ type: 'none' });
            }
          }}
        />
      </div>

      {/* Lines list */}
      {lines.length > 0 && (
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {lines.map((line) => (
            <div
              key={line.id}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                selectedLine === line.id
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border bg-muted/30 hover:bg-muted/50'
              }`}
              onClick={() => setSelectedLine(line.id)}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-background"
                style={{ backgroundColor: line.color }}
              />
              <input
                className="text-xs bg-transparent border-none outline-none flex-1 min-w-0 text-foreground placeholder:text-muted-foreground"
                value={line.name}
                onChange={(e) => updateLine(line.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Nome da linha"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1 shrink-0"
                onClick={(e) => { e.stopPropagation(); cycleDirection(line); }}
              >
                <ArrowRight className="w-3 h-3" />
                {directionLabels[line.direction]}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                onClick={(e) => { e.stopPropagation(); deleteLine(line.id); }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LineCrossingEditor;
