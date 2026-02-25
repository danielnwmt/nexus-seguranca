import { useState } from 'react';
import { DollarSign, Search, Plus, FileText, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Ban } from 'lucide-react';
import { mockInvoices, mockClients } from '@/data/mockData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Invoice } from '@/types/monitoring';

const bankLabels: Record<string, string> = {
  sicredi: 'Sicredi',
  caixa: 'Caixa Econômica',
  banco_do_brasil: 'Banco do Brasil',
  inter: 'Banco Inter',
};

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  paid: { label: 'Pago', icon: CheckCircle, className: 'bg-success/10 text-success' },
  pending: { label: 'Pendente', icon: Clock, className: 'bg-warning/10 text-warning' },
  overdue: { label: 'Atrasado', icon: AlertTriangle, className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelado', icon: Ban, className: 'bg-muted text-muted-foreground' },
};

const Financial = () => {
  const [invoices, setInvoices] = useState(mockInvoices);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ clientId: '', amount: '', dueDate: '', bank: '' });

  const filtered = invoices.filter(inv => {
    const matchSearch = inv.clientName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalReceita = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const totalPendente = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0);
  const totalAtrasado = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);

  const handleSave = () => {
    const client = mockClients.find(c => c.id === form.clientId);
    const newInvoice: Invoice = {
      id: String(invoices.length + 1),
      clientId: form.clientId,
      clientName: client?.name || 'Desconhecido',
      amount: Number(form.amount),
      dueDate: form.dueDate,
      status: 'pending',
      bank: form.bank as Invoice['bank'],
    };
    setInvoices(prev => [...prev, newInvoice]);
    setForm({ clientId: '', amount: '', dueDate: '', bank: '' });
    setDialogOpen(false);
  };

  const markAsPaid = (id: string) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid' as const, paidAt: new Date().toISOString().split('T')[0], paymentMethod: 'Manual' } : i));
  };

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground font-mono">Controle de mensalidades e boletos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Cobrança</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Nova Cobrança</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Cliente</Label>
                <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {mockClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="1500.00" className="bg-muted border-border font-mono" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Vencimento</Label>
                  <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} className="bg-muted border-border font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Banco para Boleto</Label>
                <Select value={form.bank} onValueChange={v => setForm(p => ({ ...p, bank: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sicredi">Sicredi</SelectItem>
                    <SelectItem value="caixa">Caixa Econômica</SelectItem>
                    <SelectItem value="banco_do_brasil">Banco do Brasil</SelectItem>
                    <SelectItem value="inter">Banco Inter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full">Gerar Cobrança</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Receita Recebida</span>
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <p className="text-xl font-bold font-mono text-success">{formatCurrency(totalReceita)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Pendente</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <p className="text-xl font-bold font-mono text-warning">{formatCurrency(totalPendente)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Inadimplência</span>
            <TrendingDown className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-xl font-bold font-mono text-destructive">{formatCurrency(totalAtrasado)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-9 bg-muted border-border" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-muted border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="overdue">Atrasado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoices Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Cliente</th>
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Valor</th>
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Vencimento</th>
              <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Banco</th>
              <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => {
              const st = statusConfig[inv.status];
              const StatusIcon = st.icon;
              return (
                <tr key={inv.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{inv.clientName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-mono text-foreground">{formatCurrency(inv.amount)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-mono text-foreground">{new Date(inv.dueDate).toLocaleDateString('pt-BR')}</p>
                    {inv.paidAt && <p className="text-[10px] text-muted-foreground">Pago em {new Date(inv.paidAt).toLocaleDateString('pt-BR')}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-foreground">{inv.bank ? bankLabels[inv.bank] : '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full ${st.className}`}>
                      <StatusIcon className="w-3 h-3" />
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {inv.status !== 'paid' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-success hover:text-success" onClick={() => markAsPaid(inv.id)}>
                          <CheckCircle className="w-3 h-3" /> Confirmar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                        <FileText className="w-3 h-3" /> Boleto
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <DollarSign className="w-12 h-12 mb-3" />
          <p className="text-sm">Nenhuma cobrança encontrada</p>
        </div>
      )}
    </div>
  );
};

export default Financial;
