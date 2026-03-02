import { useState, useRef, useEffect } from 'react';
import { Headphones, Send, Bot, User, Phone, Clock, MessageSquare, XCircle, Mic, MicOff, Play, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  sender: 'client' | 'operator' | 'bot';
  name: string;
  text: string;
  time: string;
  audioUrl?: string;
}

interface Ticket {
  id: string;
  client: string;
  subject: string;
  status: 'open' | 'in_progress' | 'closed';
  messages: ChatMessage[];
  createdAt: string;
}

const mockTickets: Ticket[] = [];
const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Aberto', color: 'text-yellow-500' },
  in_progress: { label: 'Em Atendimento', color: 'text-primary' },
  closed: { label: 'Encerrado', color: 'text-muted-foreground' },
};

const Support = () => {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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

  const handleSendAudio = () => {
    if (!audioUrl || !selectedTicket) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'operator',
      name: 'Operador',
      text: '🎤 Mensagem de áudio',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      audioUrl: audioUrl,
    };
    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, messages: [...t.messages, msg], status: 'in_progress' } : t));
    setSelectedTicket(prev => prev ? { ...prev, messages: [...prev.messages, msg], status: 'in_progress' } : null);
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const handleCloseTicket = (ticketId: string) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'closed' } : t));
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, status: 'closed' } : null);
    }
    toast({ title: 'Atendimento encerrado', description: 'O ticket foi marcado como encerrado.' });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível acessar o microfone.', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const cancelAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const closedCount = tickets.filter(t => t.status === 'closed').length;

  const filteredTickets = activeTab === 'queue'
    ? tickets.filter(t => t.status === 'open')
    : activeTab === 'in_progress'
      ? tickets.filter(t => t.status === 'in_progress')
      : activeTab === 'closed'
        ? tickets.filter(t => t.status === 'closed')
        : tickets;

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
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-yellow-500" />
            <div><p className="text-2xl font-bold text-foreground">{openCount}</p><p className="text-xs text-muted-foreground">Na Fila</p></div>
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
            <XCircle className="w-8 h-8 text-muted-foreground" />
            <div><p className="text-2xl font-bold text-foreground">{closedCount}</p><p className="text-xs text-muted-foreground">Encerrados</p></div>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Conversas</CardTitle>
          </CardHeader>
          <div className="px-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full bg-muted h-8">
                <TabsTrigger value="all" className="text-[10px] flex-1">Todos</TabsTrigger>
                <TabsTrigger value="queue" className="text-[10px] flex-1 gap-1">
                  Fila {openCount > 0 && <Badge variant="destructive" className="h-4 w-4 p-0 text-[9px] flex items-center justify-center rounded-full">{openCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="in_progress" className="text-[10px] flex-1">Ativos</TabsTrigger>
                <TabsTrigger value="closed" className="text-[10px] flex-1">Fechados</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredTickets.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum ticket nesta categoria</p>
              )}
              {filteredTickets.map(ticket => {
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
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedTicket.status === 'open' ? 'secondary' : selectedTicket.status === 'closed' ? 'outline' : 'default'}>
                      {statusConfig[selectedTicket.status].label}
                    </Badge>
                    {selectedTicket.status !== 'closed' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={() => handleCloseTicket(selectedTicket.id)}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Encerrar
                      </Button>
                    )}
                  </div>
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
                        {msg.audioUrl ? (
                          <audio controls src={msg.audioUrl} className="h-8 max-w-[200px]" />
                        ) : (
                          <p className="text-sm">{msg.text}</p>
                        )}
                        <p className={`text-[10px] mt-1 ${msg.sender === 'operator' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{msg.time}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              {selectedTicket.status !== 'closed' ? (
                <div className="p-3 border-t border-border space-y-2">
                  {audioUrl && (
                    <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
                      <audio controls src={audioUrl} className="h-8 flex-1" />
                      <Button size="sm" variant="ghost" onClick={cancelAudio} className="h-7 text-xs text-destructive">Cancelar</Button>
                      <Button size="sm" onClick={handleSendAudio} className="h-7 text-xs gap-1"><Send className="w-3 h-3" />Enviar</Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Digite sua mensagem..."
                      className="bg-muted border-border"
                      disabled={isRecording}
                    />
                    <Button
                      onClick={isRecording ? stopRecording : startRecording}
                      size="icon"
                      variant={isRecording ? 'destructive' : 'outline'}
                      title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
                    >
                      {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                    <Button onClick={handleSendMessage} size="icon" disabled={!newMessage.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 border-t border-border text-center text-xs text-muted-foreground">
                  Atendimento encerrado
                </div>
              )}
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
