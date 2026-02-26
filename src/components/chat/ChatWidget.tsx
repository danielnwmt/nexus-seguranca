import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface BotAction {
  keyword: string;
  response: string;
}

const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'bot', content: 'Olá! Sou o assistente Bravo. Como posso ajudar?', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getFallbackReply = (message: string): string | null => {
    try {
      const actionsJson = localStorage.getItem('bravo_bot_actions');
      if (!actionsJson) return null;
      const actions: BotAction[] = JSON.parse(actionsJson);
      const lower = message.toLowerCase();
      const match = actions.find(a => lower.includes(a.keyword.toLowerCase()));
      return match?.response || null;
    } catch {
      return null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const webhookUrl = localStorage.getItem('bravo_n8n_webhook');
      const botEnabled = localStorage.getItem('bravo_bot_enabled') !== 'false';

      let replyText = '';

      if (webhookUrl && botEnabled) {
        // Try n8n webhook first
        try {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: userMsg.content,
              source: 'bravo-chat',
              timestamp: new Date().toISOString(),
            }),
          });

          if (res.ok) {
            const data = await res.json();
            replyText = data?.reply || data?.output || data?.message || data?.text || '';
          }
        } catch {
          // n8n failed, will fallback
        }
      }

      // Fallback to local actions
      if (!replyText) {
        replyText = getFallbackReply(userMsg.content) || 'Desculpe, não entendi. Digite "ajuda" para ver o que posso fazer.';
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: replyText,
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: 'Erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 h-[500px] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <div>
            <p className="text-sm font-semibold">Assistente Bravo</p>
            <p className="text-[10px] opacity-80">Online • n8n</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="hover:opacity-70 transition-opacity">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'bot' && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <form
          onSubmit={e => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="bg-muted border-border text-sm"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatWidget;
