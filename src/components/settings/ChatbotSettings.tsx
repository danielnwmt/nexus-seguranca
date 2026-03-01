import { useState } from 'react';
import { Bot, Plus, Trash2, Save, Webhook, MessageSquare, Link, TestTube } from 'lucide-react';
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
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');
  const [n8nWebhookTest, setN8nWebhookTest] = useState('');
  const [botEnabled, setBotEnabled] = useState(true);
  const [testLoading, setTestLoading] = useState(false);

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

  const ALLOWED_WEBHOOK_DOMAINS = [
    'hooks.n8n.cloud',
    'n8n.cloud',
    'app.n8n.cloud',
  ];

  const validateWebhookUrl = (url: string): string | null => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return 'Apenas URLs HTTPS são permitidas por segurança.';
      }
      // Allow any .n8n. domain or custom n8n instances
      const hostname = parsed.hostname.toLowerCase();
      const isAllowed = ALLOWED_WEBHOOK_DOMAINS.some(d => hostname.endsWith(d)) ||
        hostname.includes('n8n');
      if (!isAllowed) {
        return 'Apenas domínios n8n são permitidos. O hostname deve conter "n8n".';
      }
      return null;
    } catch {
      return 'URL inválida. Verifique o formato.';
    }
  };

  const handleTestWebhook = async () => {
    const url = n8nWebhookTest || n8nWebhookUrl;
    if (!url) {
      toast({ title: 'Informe a URL do webhook n8n', variant: 'destructive' });
      return;
    }
    const validationError = validateWebhookUrl(url);
    if (validationError) {
      toast({ title: 'URL inválida', description: validationError, variant: 'destructive' });
      return;
    }
    setTestLoading(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'teste', source: 'nexus-test' }),
      });
      if (res.ok) {
        toast({ title: 'Webhook conectado!', description: 'O n8n respondeu com sucesso.' });
      } else {
        toast({ title: 'Erro no webhook', description: `Status: ${res.status}`, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Falha na conexão', description: 'Verifique a URL do webhook e se o n8n está ativo.', variant: 'destructive' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleSave = () => {
    if (!n8nWebhookUrl) {
      toast({ title: 'Informe a URL do webhook de produção', variant: 'destructive' });
      return;
    }
    const validationError = validateWebhookUrl(n8nWebhookUrl);
    if (validationError) {
      toast({ title: 'URL de produção inválida', description: validationError, variant: 'destructive' });
      return;
    }
    if (n8nWebhookTest) {
      const testValidation = validateWebhookUrl(n8nWebhookTest);
      if (testValidation) {
        toast({ title: 'URL de teste inválida', description: testValidation, variant: 'destructive' });
        return;
      }
    }
    // Save to localStorage for the chat widget to use
    localStorage.setItem('nexus_n8n_webhook', n8nWebhookUrl);
    localStorage.setItem('nexus_bot_actions', JSON.stringify(actions.filter(a => a.active)));
    localStorage.setItem('nexus_bot_enabled', String(botEnabled));
    toast({ title: 'Configurações do Chatbot salvas', description: 'Webhook n8n e ações atualizados.' });
  };

  return (
    <div className="space-y-4">
      {/* Webhook n8n */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="w-4 h-4" /> Integração n8n (Webhook)
          </CardTitle>
          <CardDescription className="text-xs">
            Configure os webhooks do n8n para receber e responder mensagens de atendimento ao cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Chatbot Ativo</Label>
              <p className="text-xs text-muted-foreground">Ativar/desativar o chatbot de atendimento</p>
            </div>
            <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Link className="w-3 h-3" /> URL do Webhook n8n (Produção)
            </Label>
            <Input
              value={n8nWebhookUrl}
              onChange={e => setN8nWebhookUrl(e.target.value)}
              placeholder="https://seu-n8n.app/webhook/chatbot"
              className="bg-muted border-border text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Cole aqui a URL do nó Webhook do seu workflow n8n de produção.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <TestTube className="w-3 h-3" /> URL do Webhook n8n (Teste) — opcional
            </Label>
            <Input
              value={n8nWebhookTest}
              onChange={e => setN8nWebhookTest(e.target.value)}
              placeholder="https://seu-n8n.app/webhook-test/chatbot"
              className="bg-muted border-border text-sm font-mono"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTestWebhook}
            disabled={testLoading}
            className="gap-2"
          >
            <TestTube className="w-3.5 h-3.5" />
            {testLoading ? 'Testando...' : 'Testar Webhook'}
          </Button>

          <div className="bg-muted/50 rounded-lg p-3 border border-border space-y-2">
            <Label className="text-xs font-medium text-foreground">Como configurar no n8n:</Label>
            <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Crie um novo workflow no n8n</li>
              <li>Adicione um nó <strong>Webhook</strong> como trigger (método POST)</li>
              <li>Adicione nós para processar a mensagem (ex: AI Agent, HTTP Request, etc.)</li>
              <li>No nó final, retorne um JSON com <code className="bg-muted px-1 rounded">{"{ \"reply\": \"sua resposta\" }"}</code></li>
              <li>Ative o workflow e cole a URL do webhook acima</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Ações do Bot (fallback local) */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Ações do Chatbot (Fallback)
          </CardTitle>
          <CardDescription className="text-xs">
            Respostas automáticas locais quando o webhook n8n não responder ou estiver offline
          </CardDescription>
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
