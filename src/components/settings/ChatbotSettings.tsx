import { useState } from 'react';
import { Bot, Plus, Trash2, Save, Webhook, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface BotAction {
  id: string;
  keyword: string;
  response: string;
  active: boolean;
}

const ChatbotSettings = () => {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [gupshupApiKey, setGupshupApiKey] = useState('');
  const [gupshupAppName, setGupshupAppName] = useState('');
  const [botEnabled, setBotEnabled] = useState(true);

  const [actions, setActions] = useState<BotAction[]>([
    { id: '1', keyword: 'câmera', response: 'Para verificar o status das câmeras, acesse o menu Câmeras no painel principal.', active: true },
    { id: '2', keyword: 'alarme', response: 'Os alarmes são exibidos em tempo real no Dashboard. Acesse o menu Alarmes para ver o histórico.', active: true },
    { id: '3', keyword: 'boleto', response: 'Para questões financeiras, acesse o menu Financeiro. Lá você pode gerar cobranças e acompanhar pagamentos.', active: true },
    { id: '4', keyword: 'ajuda', response: 'Posso ajudar com: 📹 Câmeras, 🚨 Alarmes, 💰 Financeiro, 👮 Vigilantes, 👥 Clientes, 💾 Backup.', active: true },
  ]);

  const [newKeyword, setNewKeyword] = useState('');
  const [newResponse, setNewResponse] = useState('');

  const addAction = () => {
    if (!newKeyword.trim() || !newResponse.trim()) {
      toast({ title: 'Preencha a palavra-chave e a resposta', variant: 'destructive' });
      return;
    }
    setActions(prev => [...prev, { id: Date.now().toString(), keyword: newKeyword.trim(), response: newResponse.trim(), active: true }]);
    setNewKeyword('');
    setNewResponse('');
    toast({ title: 'Ação adicionada' });
  };

  const removeAction = (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
    toast({ title: 'Ação removida', variant: 'destructive' });
  };

  const toggleAction = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const handleSave = () => {
    toast({ title: 'Configurações do Chatbot salvas', description: 'As ações e o webhook foram atualizados.' });
  };

  return (
    <div className="space-y-4">
      {/* Webhook Gupshup */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="w-4 h-4" /> Integração Gupshup (WhatsApp)
          </CardTitle>
          <CardDescription className="text-xs">Configure o webhook da Gupshup para integrar o chatbot com WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Chatbot Ativo</Label>
              <p className="text-xs text-muted-foreground">Ativar/desativar o chatbot de atendimento</p>
            </div>
            <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">URL do Webhook (Gupshup)</Label>
            <Input
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://api.gupshup.io/wa/webhook/..."
              className="bg-muted border-border text-sm font-mono"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">API Key Gupshup</Label>
              <Input
                type="password"
                value={gupshupApiKey}
                onChange={e => setGupshupApiKey(e.target.value)}
                placeholder="••••••••"
                className="bg-muted border-border text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome do App Gupshup</Label>
              <Input
                value={gupshupAppName}
                onChange={e => setGupshupAppName(e.target.value)}
                placeholder="bravo-whatsapp"
                className="bg-muted border-border text-sm"
              />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <Label className="text-xs text-muted-foreground">Callback URL (cole na Gupshup)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                readOnly
                value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-webhook`}
                className="bg-muted border-border text-xs font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-webhook`);
                  toast({ title: 'URL copiada!' });
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações do Bot */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Ações do Chatbot
          </CardTitle>
          <CardDescription className="text-xs">Defina palavras-chave e respostas automáticas para o atendimento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing actions */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {actions.map(action => (
              <div key={action.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <Switch checked={action.active} onCheckedChange={() => toggleAction(action.id)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">🔑 {action.keyword}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{action.response}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeAction(action.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add new action */}
          <div className="border-t border-border pt-4 space-y-3">
            <Label className="text-xs font-medium text-foreground">Adicionar Nova Ação</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Palavra-chave</Label>
                <Input
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  placeholder="ex: horário"
                  className="bg-muted border-border text-sm"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground">Resposta do Bot</Label>
                <Textarea
                  value={newResponse}
                  onChange={e => setNewResponse(e.target.value)}
                  placeholder="Digite a resposta automática..."
                  className="bg-muted border-border text-sm min-h-[60px]"
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={addAction} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar Ação
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" /> Salvar Configurações do Chatbot
        </Button>
      </div>
    </div>
  );
};

export default ChatbotSettings;
