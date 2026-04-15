import { useState, useMemo } from 'react';
import { HardDrive, Search, Plus, Check, Loader2, Wifi } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// Known RTSP URL patterns per brand
const DVR_BRANDS: Record<string, { label: string; rtspPattern: (ip: string, port: number, user: string, pass: string, ch: number, stream: number) => string }> = {
  intelbras: {
    label: 'Intelbras',
    rtspPattern: (ip, port, user, pass, ch, stream) =>
      `rtsp://${user}:${pass}@${ip}:${port}/cam/realmonitor?channel=${ch}&subtype=${stream}`,
  },
  hikvision: {
    label: 'Hikvision',
    rtspPattern: (ip, port, user, pass, ch, stream) =>
      `rtsp://${user}:${pass}@${ip}:${port}/Streaming/Channels/${ch}0${stream + 1}`,
  },
  dahua: {
    label: 'Dahua',
    rtspPattern: (ip, port, user, pass, ch, stream) =>
      `rtsp://${user}:${pass}@${ip}:${port}/cam/realmonitor?channel=${ch}&subtype=${stream}`,
  },
  axis: {
    label: 'Axis',
    rtspPattern: (ip, port, user, pass, ch, stream) =>
      `rtsp://${user}:${pass}@${ip}:${port}/axis-media/media.amp?camera=${ch}`,
  },
  samsung: {
    label: 'Samsung / Hanwha',
    rtspPattern: (ip, port, user, pass, ch, stream) =>
      `rtsp://${user}:${pass}@${ip}:${port}/profile${stream + 1}/media.smp`,
  },
  bosch: {
    label: 'Bosch',
    rtspPattern: (ip, port, user, pass, ch, stream) =>
      `rtsp://${user}:${pass}@${ip}:${port}/video${ch}`,
  },
  uniview: {
    label: 'Uniview',
    rtspPattern: (ip, port, user, pass, ch, stream) =>
      `rtsp://${user}:${pass}@${ip}:${port}/media/video${ch}`,
  },
  tvt: {
    label: 'TVT',
    rtspPattern: (ip, port, user, pass, ch, stream) =>
      `rtsp://${user}:${pass}@${ip}:${port}/chID=${ch}&streamType=${stream}&linkType=tcp`,
  },
  giga: {
    label: 'Giga Security',
    rtspPattern: (ip, port, user, pass, ch, stream) =>
      `rtsp://${user}:${pass}@${ip}:${port}/cam/realmonitor?channel=${ch}&subtype=${stream}`,
  },
  generic: {
    label: 'Genérico (ONVIF)',
    rtspPattern: (ip, port, user, pass, ch, stream) =>
      `rtsp://${user}:${pass}@${ip}:${port}/stream${ch}`,
  },
};

const CHANNEL_COUNTS = [4, 8, 16, 32] as const;

interface DiscoveredChannel {
  channel: number;
  name: string;
  rtspUrl: string;
  streamKey: string;
  selected: boolean;
}

interface DvrDiscoveryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportCameras: (cameras: Array<{ name: string; streamUrl: string; streamKey?: string; protocol: string; brand: string }>) => void;
}

const DvrDiscovery = ({ open, onOpenChange, onImportCameras }: DvrDiscoveryProps) => {
  const { toast } = useToast();
  const [dvrIp, setDvrIp] = useState('');
  const [dvrPort, setDvrPort] = useState('554');
  const [dvrUser, setDvrUser] = useState('admin');
  const [dvrPass, setDvrPass] = useState('');
  const [dvrBrand, setDvrBrand] = useState('intelbras');
  const [channelCount, setChannelCount] = useState('8');
  const [protocol, setProtocol] = useState<'RTSP' | 'RTMP'>('RTSP');
  const [channels, setChannels] = useState<DiscoveredChannel[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const brandConfig = DVR_BRANDS[dvrBrand];

  const generateStreamKey = () => {
    const len = Math.floor(Math.random() * 8) + 5; // 5-12 digits
    let key = '';
    for (let i = 0; i < len; i++) key += Math.floor(Math.random() * 10);
    return key;
  };

  // Single RTMP key for the entire DVR
  const [dvrStreamKey, setDvrStreamKey] = useState('');

  const handleDiscover = () => {
    if (!dvrIp.trim()) {
      toast({ title: 'IP obrigatório', description: 'Informe o IP do DVR/NVR.', variant: 'destructive' });
      return;
    }

    setIsSearching(true);
    const count = Number(channelCount);
    const port = Number(dvrPort) || 554;

    // For RTMP, generate a single key for the whole DVR
    const singleRtmpKey = protocol === 'RTMP' ? generateStreamKey() : '';
    const singleRtmpUrl = protocol === 'RTMP' ? `rtmp://${dvrIp}:1935/live/${singleRtmpKey}` : '';
    if (protocol === 'RTMP') setDvrStreamKey(singleRtmpKey);

    const discovered: DiscoveredChannel[] = Array.from({ length: count }, (_, i) => {
      const ch = i + 1;
      let streamUrl: string;

      if (protocol === 'RTMP') {
        streamUrl = singleRtmpUrl;
      } else {
        streamUrl = brandConfig.rtspPattern(dvrIp, port, dvrUser, dvrPass, ch, 0);
      }

      return {
        channel: ch,
        name: `Canal ${ch}`,
        rtspUrl: streamUrl,
        streamKey: protocol === 'RTMP' ? singleRtmpKey : '',
        selected: true,
      };
    });

    setTimeout(() => {
      setChannels(discovered);
      setIsSearching(false);
      toast({ title: `${count} canais encontrados`, description: `DVR ${brandConfig.label} em ${dvrIp}` });
    }, 800);
  };

  const toggleChannel = (index: number) => {
    setChannels(prev => prev.map((ch, i) => i === index ? { ...ch, selected: !ch.selected } : ch));
  };

  const toggleAll = () => {
    const allSelected = channels.every(ch => ch.selected);
    setChannels(prev => prev.map(ch => ({ ...ch, selected: !allSelected })));
  };

  const selectedCount = channels.filter(ch => ch.selected).length;

  const handleImport = () => {
    const selected = channels.filter(ch => ch.selected);
    if (selected.length === 0) {
      toast({ title: 'Selecione ao menos um canal', variant: 'destructive' });
      return;
    }

    const camerasToImport = selected.map(ch => ({
      name: ch.name,
      streamUrl: ch.rtspUrl,
      streamKey: ch.streamKey,
      protocol,
      brand: brandConfig.label,
    }));

    onImportCameras(camerasToImport);
    toast({ title: `${selected.length} câmeras importadas com sucesso!` });

    // Reset
    setChannels([]);
    onOpenChange(false);
  };

  const updateChannelName = (index: number, name: string) => {
    setChannels(prev => prev.map((ch, i) => i === index ? { ...ch, name } : ch));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary" />
            Adicionar DVR / NVR
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection details */}
          <div className="bg-muted/50 rounded-lg p-4 border border-border space-y-3">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Conexão do Dispositivo</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">IP do DVR/NVR</Label>
                <Input
                  value={dvrIp}
                  onChange={e => setDvrIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="bg-muted border-border font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Porta RTSP</Label>
                <Input
                  value={dvrPort}
                  onChange={e => setDvrPort(e.target.value)}
                  placeholder="554"
                  className="bg-muted border-border font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Usuário</Label>
                <Input
                  value={dvrUser}
                  onChange={e => setDvrUser(e.target.value)}
                  placeholder="admin"
                  className="bg-muted border-border text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Senha</Label>
                <Input
                  type="password"
                  value={dvrPass}
                  onChange={e => setDvrPass(e.target.value)}
                  placeholder="••••••"
                  className="bg-muted border-border text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Marca</Label>
                <Select value={dvrBrand} onValueChange={setDvrBrand}>
                  <SelectTrigger className="bg-muted border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DVR_BRANDS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Canais</Label>
                <Select value={channelCount} onValueChange={setChannelCount}>
                  <SelectTrigger className="bg-muted border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_COUNTS.map(c => (
                      <SelectItem key={c} value={String(c)}>{c} canais</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Protocolo</Label>
                <Select value={protocol} onValueChange={v => setProtocol(v as 'RTSP' | 'RTMP')}>
                  <SelectTrigger className="bg-muted border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RTSP">RTSP</SelectItem>
                    <SelectItem value="RTMP">RTMP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleDiscover} disabled={isSearching} className="w-full gap-2">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {isSearching ? 'Buscando canais...' : 'Buscar Câmeras'}
            </Button>
          </div>

          {/* Discovered channels */}
          {channels.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm font-semibold text-foreground">{channels.length} canais encontrados</p>
                  <Badge variant="outline" className="text-[10px]">{selectedCount} selecionados</Badge>
                </div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={toggleAll}>
                  {channels.every(ch => ch.selected) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-lg border border-border p-2 bg-muted/30">
                {channels.map((ch, idx) => (
                  <div
                    key={ch.channel}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors cursor-pointer ${
                      ch.selected ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50 border border-transparent hover:bg-muted'
                    }`}
                    onClick={() => toggleChannel(idx)}
                  >
                    <Checkbox checked={ch.selected} onCheckedChange={() => toggleChannel(idx)} />
                    <div className="flex-1 min-w-0">
                      <Input
                        value={ch.name}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateChannelName(idx, e.target.value)}
                        className="h-7 text-xs bg-transparent border-0 px-0 focus-visible:ring-0 text-foreground"
                      />
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{ch.rtspUrl}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] shrink-0">CH {ch.channel}</Badge>
                  </div>
                ))}
              </div>

              <Button onClick={handleImport} disabled={selectedCount === 0} className="w-full gap-2">
                <Plus className="w-4 h-4" />
                Importar {selectedCount} Câmera{selectedCount !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DvrDiscovery;
