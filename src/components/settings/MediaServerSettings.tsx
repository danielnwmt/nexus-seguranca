import { useState } from 'react';
import { Wifi, Save, Server, Plus, Trash2, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';

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

const INSTANCE_OPTIONS = [1, 2, 3, 4] as const;

const MediaServerSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', ip_address: '', instances: 1 });
  const [saving, setSaving] = useState(false);

  const { data: servers = [] } = useQuery({
    queryKey: ['media_servers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('media_servers').select('*').order('created_at');
      if (error) throw error;
      return data as MediaServer[];
    },
  });

  // Keep legacy company_settings.media_server_ip in sync with first server
  const { data: companySettings } = useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_settings').select('*').limit(1).single();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const syncLegacyIp = async (ip: string) => {
    if (companySettings?.id) {
      await supabase.from('company_settings').update({ media_server_ip: ip } as any).eq('id', companySettings.id);
      queryClient.invalidateQueries({ queryKey: ['company_settings'] });
    }
  };

  const resetForm = () => {
    setForm({ name: '', ip_address: '', instances: 1 });
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleSave = async () => {
    if (!form.ip_address.trim()) {
      toast({ title: 'Informe o IP ou domínio', variant: 'destructive' });
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name || `Servidor ${servers.length + 1}`,
      ip_address: form.ip_address,
      instances: form.instances,
      rtmp_base_port: 1935,
      hls_base_port: 8888,
      webrtc_base_port: 8889,
    };

    if (editingId) {
      const { error } = await supabase.from('media_servers').update(payload as any).eq('id', editingId);
      if (error) { toast({ title: 'Erro ao salvar', variant: 'destructive' }); }
      else { toast({ title: 'Servidor atualizado!' }); }
    } else {
      const { error } = await supabase.from('media_servers').insert(payload as any);
      if (error) { toast({ title: 'Erro ao adicionar', variant: 'destructive' }); }
      else { toast({ title: 'Servidor adicionado!' }); }
    }

    // Sync first server IP to legacy field
    if (servers.length === 0 || (editingId && servers[0]?.id === editingId)) {
      await syncLegacyIp(form.ip_address);
    }

    queryClient.invalidateQueries({ queryKey: ['media_servers'] });
    setSaving(false);
    resetForm();
  };

  const handleEdit = (server: MediaServer) => {
    setEditingId(server.id);
    setForm({ name: server.name, ip_address: server.ip_address, instances: server.instances });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('media_servers').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['media_servers'] });
    toast({ title: 'Servidor removido' });
  };

  const getInstancePorts = (server: MediaServer, instanceIndex: number) => ({
    rtmp: server.rtmp_base_port + instanceIndex,
    hls: server.hls_base_port + instanceIndex,
    webrtc: server.webrtc_base_port + instanceIndex,
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Wifi className="w-4 h-4 text-primary" />
              Servidores de Mídia (MediaMTX)
            </CardTitle>
            <CardDescription className="text-xs">
              Gerencie seus servidores MediaMTX. Cada servidor pode ter de 1 a 4 instâncias com portas automáticas.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingId ? 'Editar Servidor' : 'Novo Servidor MediaMTX'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome do Servidor</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Servidor Principal" className="bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">IP ou Domínio</Label>
                  <Input value={form.ip_address} onChange={e => setForm(p => ({ ...p, ip_address: e.target.value }))} placeholder="192.168.1.100 ou streaming.meudominio.com" className="bg-muted border-border font-mono" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Quantidade de Instâncias</Label>
                  <Select value={String(form.instances)} onValueChange={v => setForm(p => ({ ...p, instances: Number(v) }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INSTANCE_OPTIONS.map(n => (
                        <SelectItem key={n} value={String(n)}>{n} instância{n > 1 ? 's' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">Cada instância consome ~2-4 GB RAM e ~8-15% CPU (16 cores) para 1.000 streams.</p>
                </div>

                {/* Preview de portas */}
                {form.ip_address && (
                  <div className="bg-muted/50 rounded-lg p-3 border border-border space-y-2">
                    <p className="text-xs font-medium text-foreground">Portas por instância:</p>
                    {Array.from({ length: form.instances }, (_, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                        <Badge variant="outline" className="text-[9px] shrink-0">#{i + 1}</Badge>
                        <span>RTMP:{1935 + i}</span>
                        <span>•</span>
                        <span>HLS:{8888 + i}</span>
                        <span>•</span>
                        <span>WebRTC:{8889 + i}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {editingId ? 'Salvar Alterações' : 'Adicionar Servidor'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {servers.length === 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-xs text-destructive">
              ⚠️ Nenhum servidor configurado. Os links de streaming das câmeras não serão gerados.
            </p>
          </div>
        )}

        {servers.map(server => (
          <div key={server.id} className="bg-muted/50 rounded-lg p-4 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{server.name}</span>
                <Badge variant="outline" className="text-[10px]">{server.instances} instância{server.instances > 1 ? 's' : ''}</Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(server)}>Editar</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(server.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-muted-foreground">{server.ip_address}</code>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(server.ip_address); toast({ title: 'IP copiado!' }); }}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>

            <div className="grid gap-1.5">
              {Array.from({ length: server.instances }, (_, i) => {
                const ports = getInstancePorts(server, i);
                return (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <Badge variant="secondary" className="text-[9px] w-12 justify-center">#{i + 1}</Badge>
                    <div className="flex items-center gap-3 font-mono text-muted-foreground">
                      <span>rtmp://{server.ip_address}:{ports.rtmp}/live/</span>
                      <span>•</span>
                      <span>http://{server.ip_address}:{ports.hls}/</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default MediaServerSettings;
