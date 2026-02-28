import { useState, useEffect } from 'react';
import { Wifi, Save, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';

const MediaServerSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ip, setIp] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_settings').select('*').limit(1).single();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (settings?.media_server_ip) {
      setIp(settings.media_server_ip);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!settings?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('company_settings')
      .update({ media_server_ip: ip } as any)
      .eq('id', settings.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['company_settings'] });
      toast({ title: 'IP do servidor de mídia salvo!' });
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
          <Wifi className="w-4 h-4 text-primary" />
          Servidor de Mídia (MediaMTX)
        </CardTitle>
        <CardDescription className="text-xs">
          Configure o IP ou domínio do servidor MediaMTX para gerar os links RTMP/HLS das câmeras automaticamente.
          Os links de streaming só serão gerados após configurar o endereço.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">IP ou Domínio do Servidor MediaMTX</Label>
          <div className="flex gap-2">
            <Input
              value={ip}
              onChange={e => setIp(e.target.value)}
              placeholder="192.168.1.100 ou streaming.meudominio.com"
              className="bg-muted border-border font-mono"
            />
            <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
              <Save className="w-4 h-4" /> Salvar
            </Button>
          </div>
        </div>

        {ip && (
          <div className="bg-muted/50 rounded-lg p-3 border border-border space-y-2">
            <p className="text-xs font-medium text-foreground">Exemplo de URLs geradas:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">RTMP (Envio)</Badge>
                <code className="text-[11px] font-mono text-muted-foreground">rtmp://{ip}/live/&lt;stream_key&gt;</code>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">HLS (Visualização)</Badge>
                <code className="text-[11px] font-mono text-muted-foreground">http://{ip}:8888/&lt;stream_key&gt;/</code>
              </div>
            </div>
          </div>
        )}

        {!ip && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-xs text-destructive">
              ⚠️ Nenhum endereço configurado. Os links de streaming das câmeras não serão gerados até que o IP ou domínio do servidor seja definido.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MediaServerSettings;
