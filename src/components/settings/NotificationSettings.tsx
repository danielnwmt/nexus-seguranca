import { useState, useEffect } from 'react';
import { Bell, Mail, Webhook, Save, TestTube, Loader2, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';

interface NotificationConfig {
  id?: string;
  channel: 'email' | 'webhook' | 'whatsapp';
  enabled: boolean;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  smtp_to: string;
  webhook_url: string;
  webhook_secret: string;
  whatsapp_api_url: string;
  whatsapp_token: string;
  whatsapp_to: string;
  events: string[];
}

const EVENT_OPTIONS = [
  { value: 'camera_offline', label: 'Câmera Offline' },
  { value: 'camera_online', label: 'Câmera Online' },
  { value: 'alarm_critical', label: 'Alarme Crítico' },
  { value: 'alarm_high', label: 'Alarme Alto' },
  { value: 'disk_warning', label: 'Disco > 90%' },
  { value: 'ai_detection', label: 'Detecção IA' },
  { value: 'recording_error', label: 'Erro de Gravação' },
  { value: 'service_down', label: 'Serviço Caiu' },
];

const defaultConfig: NotificationConfig = {
  channel: 'webhook',
  enabled: false,
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_from: '',
  smtp_to: '',
  webhook_url: '',
  webhook_secret: '',
  whatsapp_api_url: '',
  whatsapp_token: '',
  whatsapp_to: '',
  events: ['camera_offline', 'alarm_critical', 'disk_warning', 'service_down'],
};

const NotificationSettings = () => {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
      if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    } catch {}
    return headers;
  };

  useEffect(() => {
    if (!isLocalInstallation()) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`${getLocalApiBase()}/api/notifications/config`, { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          setConfigs(data.length > 0 ? data : [{ ...defaultConfig }]);
        } else {
          setConfigs([{ ...defaultConfig }]);
        }
      } catch {
        setConfigs([{ ...defaultConfig }]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateConfig = (index: number, field: string, value: any) => {
    setConfigs(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const toggleEvent = (index: number, event: string) => {
    setConfigs(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const events = c.events.includes(event)
        ? c.events.filter(e => e !== event)
        : [...c.events, event];
      return { ...c, events };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${getLocalApiBase()}/api/notifications/config`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ configs }),
      });
      if (res.ok) {
        toast({ title: 'Configurações salvas' });
      } else {
        toast({ title: 'Erro ao salvar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro de conexão', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (index: number) => {
    const config = configs[index];
    setTesting(config.channel);
    try {
      const res = await fetch(`${getLocalApiBase()}/api/notifications/test`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ channel: config.channel }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: 'Teste enviado com sucesso!' });
      } else {
        toast({ title: 'Falha no teste', description: data.error || 'Verifique as configurações', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro de conexão', variant: 'destructive' });
    } finally {
      setTesting(null);
    }
  };

  const addChannel = () => {
    const usedChannels = configs.map(c => c.channel);
    const available = (['email', 'webhook', 'whatsapp'] as const).find(ch => !usedChannels.includes(ch));
    if (available) {
      setConfigs(prev => [...prev, { ...defaultConfig, channel: available }]);
    }
  };

  if (!isLocalInstallation()) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">Notificações disponíveis apenas em instalações locais.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {configs.map((config, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                {config.channel === 'email' && <Mail className="w-4 h-4 text-primary" />}
                {config.channel === 'webhook' && <Webhook className="w-4 h-4 text-primary" />}
                {config.channel === 'whatsapp' && <Phone className="w-4 h-4 text-primary" />}
                {config.channel === 'email' ? 'Email (SMTP)' : config.channel === 'webhook' ? 'Webhook (n8n/Zapier)' : 'WhatsApp API'}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(v) => updateConfig(idx, 'enabled', v)}
                />
                <span className="text-xs text-muted-foreground">{config.enabled ? 'Ativo' : 'Inativo'}</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.channel === 'email' && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Servidor SMTP</Label><Input className="h-8 text-xs" value={config.smtp_host} onChange={e => updateConfig(idx, 'smtp_host', e.target.value)} placeholder="smtp.gmail.com" /></div>
                <div><Label className="text-xs">Porta</Label><Input className="h-8 text-xs" value={config.smtp_port} onChange={e => updateConfig(idx, 'smtp_port', e.target.value)} placeholder="587" /></div>
                <div><Label className="text-xs">Usuário</Label><Input className="h-8 text-xs" value={config.smtp_user} onChange={e => updateConfig(idx, 'smtp_user', e.target.value)} placeholder="user@email.com" /></div>
                <div><Label className="text-xs">Senha</Label><Input className="h-8 text-xs" type="password" value={config.smtp_pass} onChange={e => updateConfig(idx, 'smtp_pass', e.target.value)} /></div>
                <div><Label className="text-xs">De (From)</Label><Input className="h-8 text-xs" value={config.smtp_from} onChange={e => updateConfig(idx, 'smtp_from', e.target.value)} placeholder="nexus@empresa.com" /></div>
                <div><Label className="text-xs">Para (To)</Label><Input className="h-8 text-xs" value={config.smtp_to} onChange={e => updateConfig(idx, 'smtp_to', e.target.value)} placeholder="admin@empresa.com" /></div>
              </div>
            )}

            {config.channel === 'webhook' && (
              <div className="space-y-3">
                <div><Label className="text-xs">URL do Webhook</Label><Input className="h-8 text-xs" value={config.webhook_url} onChange={e => updateConfig(idx, 'webhook_url', e.target.value)} placeholder="https://n8n.empresa.com/webhook/nexus" /></div>
                <div><Label className="text-xs">Secret (opcional)</Label><Input className="h-8 text-xs" value={config.webhook_secret} onChange={e => updateConfig(idx, 'webhook_secret', e.target.value)} placeholder="chave-secreta" /></div>
              </div>
            )}

            {config.channel === 'whatsapp' && (
              <div className="space-y-3">
                <div><Label className="text-xs">URL da API WhatsApp</Label><Input className="h-8 text-xs" value={config.whatsapp_api_url} onChange={e => updateConfig(idx, 'whatsapp_api_url', e.target.value)} placeholder="https://api.z-api.io/instances/..." /></div>
                <div><Label className="text-xs">Token</Label><Input className="h-8 text-xs" type="password" value={config.whatsapp_token} onChange={e => updateConfig(idx, 'whatsapp_token', e.target.value)} /></div>
                <div><Label className="text-xs">Número destino</Label><Input className="h-8 text-xs" value={config.whatsapp_to} onChange={e => updateConfig(idx, 'whatsapp_to', e.target.value)} placeholder="5511999999999" /></div>
              </div>
            )}

            <div>
              <Label className="text-xs mb-2 block">Eventos para notificar</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {EVENT_OPTIONS.map(ev => (
                  <label key={ev.value} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={config.events.includes(ev.value)}
                      onCheckedChange={() => toggleEvent(idx, ev.value)}
                    />
                    {ev.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => handleTest(idx)} disabled={testing === config.channel}>
                {testing === config.channel ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <TestTube className="w-3 h-3 mr-1" />}
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-2">
        {configs.length < 3 && (
          <Button variant="outline" size="sm" onClick={addChannel}>
            + Adicionar Canal
          </Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
};

export default NotificationSettings;
