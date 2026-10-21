import { useEffect, useState } from 'react';
import { QrCode, Smartphone, Copy, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const KEY = 'nexus_whatsapp_config';
const GUPSHUP_WEBHOOK = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/chatbot-webhook?provider=gupshup`;

type Cfg = { mode: 'qrcode' | 'gupshup'; evoUrl: string; evoKey: string; evoInstance: string; gsApiKey: string; gsApp: string; gsNumber: string };
const blank: Cfg = { mode: 'qrcode', evoUrl: '', evoKey: '', evoInstance: 'nexus', gsApiKey: '', gsApp: '', gsNumber: '' };

const WhatsAppConnect = () => {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<Cfg>(() => { try { return { ...blank, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank; } });
  const [qr, setQr] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: keyof Cfg, v: string) => setCfg(p => ({ ...p, [k]: v }));
  const base = cfg.evoUrl.replace(/\/$/, '');
  const headers = { apikey: cfg.evoKey, 'Content-Type': 'application/json' };

  const save = () => { localStorage.setItem(KEY, JSON.stringify(cfg)); toast({ title: 'WhatsApp salvo' }); };

  const checkState = async () => {
    try {
      const r = await fetch(`${base}/instance/connectionState/${cfg.evoInstance}`, { headers });
      const j = await r.json();
      const s = j?.instance?.state || j?.state || '';
      setState(s);
      if (s === 'open') setQr('');
    } catch { /* ignore */ }
  };

  const generateQr = async () => {
    if (!base.startsWith('https://') && !base.startsWith('http://')) return toast({ title: 'Informe a URL da API', variant: 'destructive' });
    if (!cfg.evoKey || !cfg.evoInstance) return toast({ title: 'Informe a chave e a instância', variant: 'destructive' });
    setLoading(true);
    try {
      await fetch(`${base}/instance/create`, { method: 'POST', headers, body: JSON.stringify({ instanceName: cfg.evoInstance, qrcode: true, integration: 'WHATSAPP-BAILEYS' }) }).catch(() => null);
      const r = await fetch(`${base}/instance/connect/${cfg.evoInstance}`, { headers });
      const j = await r.json();
      const img = j?.base64 || j?.qrcode?.base64 || '';
      if (img) { setQr(img.startsWith('data:') ? img : `data:image/png;base64,${img}`); setState('connecting'); save(); }
      else { await checkState(); toast({ title: j?.instance?.state === 'open' ? 'Número já conectado' : 'QR Code não retornado' }); }
    } catch {
      toast({ title: 'Falha ao conectar na API', description: 'Verifique a URL e a chave.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!qr) return;
    const t = setInterval(checkState, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr]);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Smartphone className="w-4 h-4" /> Conexão WhatsApp</CardTitle>
        <CardDescription className="text-xs">Conecte o número por QR Code ou pela Gupshup (API oficial)</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={cfg.mode} onValueChange={v => set('mode', v)}>
          <TabsList><TabsTrigger value="qrcode">QR Code</TabsTrigger><TabsTrigger value="gupshup">Gupshup</TabsTrigger></TabsList>

          <TabsContent value="qrcode" className="space-y-3 pt-2">
            <div className="grid gap-3 md:grid-cols-3">
              <div><Label className="text-xs">URL da API (Evolution)</Label><Input className="text-xs font-mono" value={cfg.evoUrl} onChange={e => set('evoUrl', e.target.value)} placeholder="https://evolution.seudominio.com" /></div>
              <div><Label className="text-xs">Chave da API</Label><Input className="text-xs" type="password" value={cfg.evoKey} onChange={e => set('evoKey', e.target.value)} /></div>
              <div><Label className="text-xs">Nome da instância</Label><Input className="text-xs" value={cfg.evoInstance} onChange={e => set('evoInstance', e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={generateQr} disabled={loading} className="gap-2"><QrCode className="w-3.5 h-3.5" />{loading ? 'Gerando...' : 'Gerar QR Code'}</Button>
              <Button size="sm" variant="outline" onClick={checkState} className="gap-2"><RefreshCw className="w-3.5 h-3.5" />Verificar</Button>
            </div>
            {state && <p className="text-xs font-mono">Status: <span className={state === 'open' ? 'text-primary' : 'text-muted-foreground'}>{state === 'open' ? 'CONECTADO' : state.toUpperCase()}</span></p>}
            {qr && (
              <div className="flex flex-col items-start gap-2">
                <img src={qr} alt="QR Code do WhatsApp" className="w-56 h-56 rounded-lg bg-foreground p-2" />
                <p className="text-[11px] text-muted-foreground">WhatsApp → Aparelhos conectados → Conectar aparelho → escaneie.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="gupshup" className="space-y-3 pt-2">
            <div className="grid gap-3 md:grid-cols-3">
              <div><Label className="text-xs">API Key</Label><Input className="text-xs" type="password" value={cfg.gsApiKey} onChange={e => set('gsApiKey', e.target.value)} /></div>
              <div><Label className="text-xs">Nome do App</Label><Input className="text-xs" value={cfg.gsApp} onChange={e => set('gsApp', e.target.value)} /></div>
              <div><Label className="text-xs">Número de origem</Label><Input className="text-xs" value={cfg.gsNumber} onChange={e => set('gsNumber', e.target.value.replace(/\D/g, ''))} placeholder="5566999999999" /></div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL de Callback (cole na Gupshup → App → Webhooks)</Label>
              <div className="flex gap-2">
                <Input readOnly className="text-xs font-mono" value={GUPSHUP_WEBHOOK} />
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(GUPSHUP_WEBHOOK); toast({ title: 'Copiado' }); }}><Copy className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <Button size="sm" className="mt-3" onClick={save}>Salvar WhatsApp</Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppConnect;
