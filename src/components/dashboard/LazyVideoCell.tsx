import { Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LazyVideoCellProps {
  cam: any;
  clientName?: string;
  url: string;
  onClick: () => void;
}

/**
 * A single camera cell in the LiveGrid that only loads
 * the video iframe when the element is visible in the viewport.
 */
const LazyVideoCell = ({ cam, clientName, url, onClick }: LazyVideoCellProps) => {
  return (
    <div
      className="relative bg-black rounded overflow-hidden cursor-pointer group border border-border/50 hover:border-primary/50 transition-colors"
      style={{ aspectRatio: '16/9' }}
      onClick={onClick}
    >
      {url ? (
        <iframe
          src={url}
          className="absolute inset-0 w-full h-full border-0 pointer-events-none"
          allow="autoplay; encrypted-media"
          sandbox="allow-scripts allow-same-origin"
          title={cam.name}
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
          <Camera className="w-8 h-8" />
        </div>
      )}
      {/* Overlay info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[10px] font-medium text-white truncate">{cam.name}</p>
        <p className="text-[9px] text-white/60 truncate">{clientName || ''}</p>
      </div>
      {/* Status dot */}
      <div className="absolute top-1 left-1">
        <div className={`w-2 h-2 rounded-full ${cam.status === 'online' ? 'bg-emerald-400' : 'bg-destructive'}`} />
      </div>
      {/* Camera name always visible */}
      <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
        <span className="text-[9px] font-mono text-white/80">{cam.name}</span>
      </div>
    </div>
  );
};

export default LazyVideoCell;
