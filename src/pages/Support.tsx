import { useState, useRef, useEffect } from 'react';
import { Headphones, Send, Bot, User, Phone, Clock, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessage {
  id: string;
  sender: 'client' | 'operator' | 'bot';
  name: string;
  text: string;
  time: string;
}

interface Ticket {
  id: string;
  client: string;
  subject: string;
  status: 'open' | 'in_progress' | 'closed';
  messages: ChatMessage[];
  createdAt: string;
}

const mockTickets: Ticket[] = [
  {
    id: '1', client: 'Maria Silva', subject: 'Câmera offline', status: 'open', createdAt: new Date().toISOString(),
    messages: [
      { id: '1', sender: 'client', name: 'Maria Silva', text: 'Olá, minha câmera do portão está offline desde ontem.', time: '10:30' },
      { id: '2', sender: 'bot', name: 'Assistente', text: 'Olá Maria! Identificamos que a câmera CAM-001 está offline. Um técnico será notificado.', time: '10:30' },
    ],
  },
  {
    id: '2', client: 'João Santos', subject: 'Solicitar manutenção', status: 'in_progress', createdAt: new Date().toISOString(),
    messages: [
      { id: '1', sender: 'client', name: 'João Santos', text: 'Preciso de manutenção no sistema de alarme.', time: '09:15' },
      { id: '2', sender: 'operator', name: 'Operador', text: 'Bom dia João! Já estamos agendando a visita técnica.', time: '09:20' },
    ],
  },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Aberto', color: 'text-yellow-500' },
  in_progress: { label: 'Em Atendimento', color: 'text-primary' },
  closed: { label: 'Encerrado', color: 'text-muted-foreground' },
};

const Support = () => {
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(mockTickets[0]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedTicket) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'operator',
      name: 'Operador',
      text: newMessage,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, messages: [...t.messages, msg], status: 'in_progress' } : t));
    setSelectedTicket(prev => prev ? { ...prev, messages: [...prev.messages, msg], status: 'in_progress' } : null);
    setNewMessage('');
  };

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Headphones className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel de Atendimento</h1>
          <p className="text-sm text-muted-foreground font-mono">Central de suporte e chatbot</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-yellow-500" />
            <div><p className="text-2xl font-bold text-foreground">{openCount}</p><p className="text-xs text-muted-foreground">Abertos</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-primary" />
            <div><p className="text-2xl font-bold text-foreground">{inProgressCount}</p><p className="text-xs text-muted-foreground">Em Atendimento</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Phone className="w-8 h-8 text-muted-foreground" />
            <div><p className="text-2xl font-bold text-foreground">{tickets.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Chat Panel */}
      <div className="grid grid-cols-12 gap-4 h-[500px]">
        {/* Ticket List */}
        <Card className="col-span-4 bg-card border-border flex flex-col">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Conversas</CardTitle></CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {tickets.map(ticket => {
                const sc = statusConfig[ticket.status];
                const isSelected = selectedTicket?.id === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{ticket.client}</span>
                      <span className={`text-[10px] font-mono ${sc.color}`}>{sc.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{ticket.subject}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{ticket.messages[ticket.messages.length - 1]?.text.slice(0, 50)}...</p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat Area */}
        <Card className="col-span-8 bg-card border-border flex flex-col">
          {selectedTicket ? (
            <>
              <CardHeader className="pb-2 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">{selectedTicket.client}</CardTitle>
                    <CardDescription className="text-xs">{selectedTicket.subject}</CardDescription>
                  </div>
                  <Badge variant={selectedTicket.status === 'open' ? 'secondary' : 'default'}>
                    {statusConfig[selectedTicket.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {selectedTicket.messages.map(msg => (
                    <div key={msg.id} className={`flex gap-2 ${msg.sender === 'operator' ? 'justify-end' : ''}`}>
                      {msg.sender !== 'operator' && (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'bot' ? 'bg-primary/20' : 'bg-muted'}`}>
                          {msg.sender === 'bot' ? <Bot className="w-3.5 h-3.5 text-primary" /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      )}
                      <div className={`max-w-[70%] rounded-lg p-2.5 ${msg.sender === 'operator' ? 'bg-primary text-primary-foreground' : msg.sender === 'bot' ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
                        <p className="text-xs font-medium mb-0.5">{msg.name}</p>
                        <p className="text-sm">{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${msg.sender === 'operator' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{msg.time}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-border flex gap-2">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Digite sua mensagem..."
                  className="bg-muted border-border"
                />
                <Button onClick={handleSendMessage} size="icon"><Send className="w-4 h-4" /></Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione uma conversa para iniciar
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Support;
