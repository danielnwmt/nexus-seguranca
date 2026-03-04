import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, MousePointer, ArrowRight } from 'lucide-react';

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

const LINE_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

const LineCrossingEditor = ({ lines, onChange, snapshotUrl }: LineCrossingEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  // Load background image
  useEffect(() => {
    if (snapshotUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setBgImage(img);
      img.src = snapshotUrl;
    }
  }, [snapshotUrl]);

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  // Draw everything
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
    } else {
      ctx.fillStyle = 'hsl(220, 20%, 12%)';
      ctx.fillRect(0, 0, w, h);
      // Grid pattern
      ctx.strokeStyle = 'hsl(220, 15%, 18%)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.fillStyle = 'hsl(220, 10%, 35%)';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Snapshot indisponível — desenhe as linhas sobre a grade', w / 2, h / 2);
    }

    // Draw saved lines
    lines.forEach((line) => {
      const isSelected = line.id === selectedLine;
      ctx.strokeStyle = line.color;
      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(line.x1 * w, line.y1 * h);
      ctx.lineTo(line.x2 * w, line.y2 * h);
      ctx.stroke();

      // Endpoints
      [{ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }].forEach((pt) => {
        ctx.fillStyle = line.color;
        ctx.beginPath();
        ctx.arc(pt.x * w, pt.y * h, isSelected ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Direction arrow at midpoint
      const mx = ((line.x1 + line.x2) / 2) * w;
      const my = ((line.y1 + line.y2) / 2) * h;
      const angle = Math.atan2((line.y2 - line.y1) * h, (line.x2 - line.x1) * w);

      if (line.direction !== 'both') {
        const perpAngle = line.direction === 'left_to_right' ? angle + Math.PI / 2 : angle - Math.PI / 2;
        const arrowLen = 18;
        const ax = mx + Math.cos(perpAngle) * arrowLen;
        const ay = my + Math.sin(perpAngle) * arrowLen;
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(ax, ay);
        ctx.stroke();
        // Arrowhead
        const headLen = 8;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - headLen * Math.cos(perpAngle - 0.4), ay - headLen * Math.sin(perpAngle - 0.4));
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - headLen * Math.cos(perpAngle + 0.4), ay - headLen * Math.sin(perpAngle + 0.4));
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = line.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(line.name, mx, my - 12);
    });

    // Drawing preview
    if (drawing && startPoint && currentPoint) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(startPoint.x * w, startPoint.y * h);
      ctx.lineTo(currentPoint.x * w, currentPoint.y * h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Start point
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(startPoint.x * w, startPoint.y * h, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [lines, drawing, startPoint, currentPoint, selectedLine, bgImage]);

  useEffect(() => { draw(); }, [draw]);

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = Math.round(container.clientWidth * 9 / 16); // 16:9
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    // Check if clicking near an existing line endpoint to select
    const clickedLine = lines.find((line) => {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      const w = canvas.width;
      const h = canvas.height;
      const dist1 = Math.hypot((line.x1 - coords.x) * w, (line.y1 - coords.y) * h);
      const dist2 = Math.hypot((line.x2 - coords.x) * w, (line.y2 - coords.y) * h);
      return dist1 < 15 || dist2 < 15;
    });

    if (clickedLine) {
      setSelectedLine(clickedLine.id);
      return;
    }

    setSelectedLine(null);
    setDrawing(true);
    setStartPoint(coords);
    setCurrentPoint(coords);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    setCurrentPoint(getCanvasCoords(e));
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !startPoint) return;
    const end = getCanvasCoords(e);

    // Min distance check
    const canvas = canvasRef.current;
    if (canvas) {
      const dist = Math.hypot((end.x - startPoint.x) * canvas.width, (end.y - startPoint.y) * canvas.height);
      if (dist < 20) {
        setDrawing(false);
        setStartPoint(null);
        setCurrentPoint(null);
        return;
      }
    }

    const colorIdx = lines.length % LINE_COLORS.length;
    const newLine: LineCrossingLine = {
      id: crypto.randomUUID(),
      name: `Linha ${lines.length + 1}`,
      x1: startPoint.x,
      y1: startPoint.y,
      x2: end.x,
      y2: end.y,
      direction: 'both',
      color: LINE_COLORS[colorIdx],
    };

    onChange([...lines, newLine]);
    setSelectedLine(newLine.id);
    setDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  const deleteLine = (id: string) => {
    onChange(lines.filter(l => l.id !== id));
    if (selectedLine === id) setSelectedLine(null);
  };

  const updateLine = (id: string, updates: Partial<LineCrossingLine>) => {
    onChange(lines.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const directionLabels: Record<string, string> = {
    both: 'Ambos',
    left_to_right: 'A → B',
    right_to_left: 'B → A',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MousePointer className="w-3 h-3" /> Clique e arraste para traçar linhas de cruzamento
        </p>
        <Badge variant="outline" className="text-[10px]">{lines.length} linha(s)</Badge>
      </div>

      <div ref={containerRef} className="relative rounded-lg overflow-hidden border border-border">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (drawing) {
              setDrawing(false);
              setStartPoint(null);
              setCurrentPoint(null);
            }
          }}
        />
      </div>

      {/* Lines list */}
      {lines.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {lines.map((line) => (
            <div
              key={line.id}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
                selectedLine === line.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50'
              }`}
              onClick={() => setSelectedLine(line.id)}
            >
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: line.color }} />
              <input
                className="text-xs bg-transparent border-none outline-none flex-1 min-w-0 text-foreground"
                value={line.name}
                onChange={(e) => updateLine(line.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  const dirs: Array<LineCrossingLine['direction']> = ['both', 'left_to_right', 'right_to_left'];
                  const idx = dirs.indexOf(line.direction);
                  updateLine(line.id, { direction: dirs[(idx + 1) % dirs.length] });
                }}
              >
                <ArrowRight className="w-3 h-3" />
                {directionLabels[line.direction]}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
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
