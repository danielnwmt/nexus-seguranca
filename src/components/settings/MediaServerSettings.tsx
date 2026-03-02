import { Wifi, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MediaServer {
  id: string;
  name: string;
  ip_address: string;
  instances: number;
  rtmp_base_port: number;
  hls_base_port: number;
  webrtc_base_port: number;
  status: string;
}

const MediaServerSettings = () => {
  const { data: servers = [] } = useQuery({
    queryKey: ['media_servers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('media_servers').select('*').order('created_at');
      if (error) throw error;
      return data as MediaServer[];
    },
  });

  const activeServers = servers.filter(s => s.status === 'online' || s.status === 'active');

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wifi className="w-4 h-4 text-primary" />
          Servidor de Mídia Ativo
        </CardTitle>
        <CardDescription className="text-xs">
          Selecione o servidor MediaMTX que será utilizado para streaming das câmeras.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {servers.length === 0 ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-xs text-destructive">
              ⚠️ Nenhum servidor cadastrado. Cadastre um servidor na aba de servidores para habilitar o streaming.
            </p>
          </div>
        ) : (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">Servidor MediaMTX</Label>
              <Select value={activeServers[0]?.id || ''} disabled>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Selecione o servidor" />
                </SelectTrigger>
                <SelectContent>
                  {servers.map(server => (
                    <SelectItem key={server.id} value={server.id}>
                      <div className="flex items-center gap-2">
                        <Server className="w-3.5 h-3.5" />
                        <span>{server.name}</span>
                        <span className="text-muted-foreground font-mono text-xs">({server.ip_address})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeServers[0] && (
              <div className="bg-muted/50 rounded-lg p-3 border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{activeServers[0].name}</span>
                  <Badge variant="outline" className="text-[10px]">{activeServers[0].instances} instância{activeServers[0].instances > 1 ? 's' : ''}</Badge>
                  <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Online</Badge>
                </div>
                <div className="grid gap-1.5">
                  {Array.from({ length: activeServers[0].instances }, (_, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <Badge variant="secondary" className="text-[9px] w-12 justify-center">#{i + 1}</Badge>
                      <div className="flex items-center gap-3 font-mono text-muted-foreground">
                        <span>RTMP:{activeServers[0].rtmp_base_port + i}</span>
                        <span>•</span>
                        <span>HLS:{activeServers[0].hls_base_port + i}</span>
                        <span>•</span>
                        <span>WebRTC:{activeServers[0].webrtc_base_port + i}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MediaServerSettings;
