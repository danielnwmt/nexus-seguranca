import { useState, useMemo } from 'react';
import { DollarSign, Search, Plus, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Ban, Trash2, Send, XCircle, Receipt, CreditCard, Edit, BarChart3, ArrowUpRight, ArrowDownRight, Wallet, PiggyBank, Activity, Target, Percent, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart, LineChart, Line, Legend, RadialBarChart, RadialBar, ComposedChart } from 'recharts';

const COLORS = ['hsl(142, 70%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 50%)', 'hsl(175, 80%, 45%)', 'hsl(280, 60%, 50%)'];

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

const billCategories: Record<string, string> = {
  general: 'Geral',
  rent: 'Aluguel',
  utilities: 'Utilidades (Água/Luz/Internet)',
  salary: 'Salários',
  equipment: 'Equipamentos',
  maintenance: 'Manutenção',
  taxes: 'Impostos',
  software: 'Software/Licenças',
  other: 'Outros',
};

const Financial = () => {
  const { toast } = useToast();
  const { data: invoices = [], isLoading } = useTableQuery('invoices');
  const { data: clients = [] } = useTableQuery('clients');
  const { data: bills = [], isLoading: billsLoading } = useTableQuery('bills');
  const insertMutation = useInsertMutation('invoices');
  const updateMutation = useUpdateMutation('invoices');
  const deleteMutation = useDeleteMutation('invoices');
  const insertBillMutation = useInsertMutation('bills');
  const updateBillMutation = useUpdateMutation('bills');
  const deleteBillMutation = useDeleteMutation('bills');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ clientId: '', amount: '', dueDate: '', bank: '' });
  const [sendingBoleto, setSendingBoleto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [billSearch, setBillSearch] = useState('');
  const [billFilterStatus, setBillFilterStatus] = useState<string>('all');
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any>(null);
  const [billForm, setBillForm] = useState({ description: '', category: 'general', amount: '', dueDate: '', supplier: '', notes: '' });
  const [billErrors, setBillErrors] = useState<Record<string, string>>({});

  const activeBanks = [...new Set(invoices.filter((i: any) => i.bank).map((i: any) => i.bank))] as string[];

  const filtered = invoices.filter((inv: any) => {
    const matchSearch = (inv.client_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const filteredBills = bills.filter((bill: any) => {
    const matchSearch = (bill.description || '').toLowerCase().includes(billSearch.toLowerCase()) ||
      (bill.supplier || '').toLowerCase().includes(billSearch.toLowerCase());
    const matchStatus = billFilterStatus === 'all' || bill.status === billFilterStatus;
    return matchSearch && matchStatus;
  });

  const totalReceita = invoices.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + Number(i.amount), 0);
  const totalPendente = invoices.filter((i: any) => i.status === 'pending').reduce((sum: number, i: any) => sum + Number(i.amount), 0);
  const totalAtrasado = invoices.filter((i: any) => i.status === 'overdue').reduce((sum: number, i: any) => sum + Number(i.amount), 0);

  const totalBillsPaid = bills.filter((b: any) => b.status === 'paid').reduce((sum: number, b: any) => sum + Number(b.amount), 0);
  const totalBillsPending = bills.filter((b: any) => b.status === 'pending').reduce((sum: number, b: any) => sum + Number(b.amount), 0);
  const totalBillsOverdue = bills.filter((b: any) => b.status === 'overdue').reduce((sum: number, b: any) => sum + Number(b.amount), 0);

  const totalMonthlyRevenue = (clients as any[]).filter(c => c.status === 'active').reduce((sum, c) => sum + (c.monthly_fee || 0), 0);
  const totalDespesas = totalBillsPaid + totalBillsPending + totalBillsOverdue;
  const netProfit = totalReceita - totalBillsPaid;
  const totalInvoiceValue = totalReceita + totalPendente + totalAtrasado;
  const collectionRate = totalInvoiceValue > 0 ? (totalReceita / totalInvoiceValue) * 100 : 0;
  const overdueRate = totalInvoiceValue > 0 ? (totalAtrasado / totalInvoiceValue) * 100 : 0;

  const invoiceStatusData = [
    { name: 'Pago', value: totalReceita },
    { name: 'Pendente', value: totalPendente },
    { name: 'Atrasado', value: totalAtrasado },
  ].filter(d => d.value > 0);

  const expenseByCategory = Object.entries(billCategories).map(([key, label]) => ({
    name: label.split(' ')[0],
    value: bills.filter((b: any) => b.category === key).reduce((sum: number, b: any) => sum + Number(b.amount), 0),
  })).filter(d => d.value > 0);

  const cashFlowData = useMemo(() => {
    const months: Record<string, { receita: number; despesa: number }> = {};
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    invoices.forEach((inv: any) => {
      if (inv.status === 'paid' && inv.paid_at) {
        const d = new Date(inv.paid_at);
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
        if (!months[key]) months[key] = { receita: 0, despesa: 0 };
        months[key].receita += Number(inv.amount);
      }
    });
    bills.forEach((b: any) => {
      if (b.status === 'paid' && b.paid_at) {
        const d = new Date(b.paid_at);
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
        if (!months[key]) months[key] = { receita: 0, despesa: 0 };
        months[key].despesa += Number(b.amount);
      }
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([key, val]) => {
      const [, m] = key.split('-');
      return { name: monthNames[parseInt(m)], receita: val.receita, despesa: val.despesa };
    });
  }, [invoices, bills]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.clientId) newErrors.clientId = 'Selecione um cliente';
    if (!form.amount || Number(form.amount) <= 0) newErrors.amount = 'Informe um valor válido';
    if (!form.dueDate) newErrors.dueDate = 'Informe a data de vencimento';
    if (!form.bank) newErrors.bank = 'Selecione o banco';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast({ title: 'Campos obrigatórios', description: Object.values(newErrors).join(', '), variant: 'destructive' });
    }
    return Object.keys(newErrors).length === 0;
  };

  const validateBill = () => {
    const newErrors: Record<string, string> = {};
    if (!billForm.description) newErrors.description = 'Informe a descrição';
    if (!billForm.amount || Number(billForm.amount) <= 0) newErrors.amount = 'Informe um valor válido';
    if (!billForm.dueDate) newErrors.dueDate = 'Informe a data de vencimento';
    setBillErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast({ title: 'Campos obrigatórios', description: Object.values(newErrors).join(', '), variant: 'destructive' });
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const client = clients.find((c: any) => c.id === form.clientId);
    insertMutation.mutate({
      client_id: form.clientId,
      client_name: (client as any)?.name || 'Desconhecido',
      amount: Number(form.amount),
      due_date: form.dueDate,
      bank: form.bank || null,
    } as any);
    setForm({ clientId: '', amount: '', dueDate: '', bank: '' });
    setErrors({});
    setDialogOpen(false);
  };

  const handleSaveBill = () => {
    if (!validateBill()) return;
    const data = {
      description: billForm.description,
      category: billForm.category,
      amount: Number(billForm.amount),
      due_date: billForm.dueDate,
      supplier: billForm.supplier || null,
      notes: billForm.notes || null,
    } as any;
    if (editingBill) {
      updateBillMutation.mutate({ id: editingBill.id, ...data } as any);
    } else {
      insertBillMutation.mutate(data);
    }
    setBillForm({ description: '', category: 'general', amount: '', dueDate: '', supplier: '', notes: '' });
    setBillErrors({});
    setBillDialogOpen(false);
    setEditingBill(null);
  };

  const openEditBill = (bill: any) => {
    setEditingBill(bill);
    setBillForm({ description: bill.description || '', category: bill.category || 'general', amount: String(bill.amount || ''), dueDate: bill.due_date || '', supplier: bill.supplier || '', notes: bill.notes || '' });
    setBillDialogOpen(true);
  };

  const openAddBill = () => {
    setEditingBill(null);
    setBillForm({ description: '', category: 'general', amount: '', dueDate: '', supplier: '', notes: '' });
    setBillDialogOpen(true);
  };

  const handlePayBill = (bill: any) => {
    updateBillMutation.mutate({ id: bill.id, status: 'paid', paid_at: new Date().toISOString().split('T')[0] } as any);
    toast({ title: 'Conta marcada como paga' });
  };

  const handleDeleteBill = (id: string) => deleteBillMutation.mutate(id);

  const handleSendBoleto = (inv: any) => {
    setSendingBoleto(inv.id);
    setTimeout(() => {
      updateMutation.mutate({ id: inv.id, boleto_url: `boleto-registrado-${Date.now()}` } as any);
      setSendingBoleto(null);
    }, 1500);
  };

  const handleCancelBoleto = (inv: any) => updateMutation.mutate({ id: inv.id, boleto_url: null } as any);
  const handleDeleteInvoice = (id: string) => deleteMutation.mutate(id);
  const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const monthlyTrend = useMemo(() => {
    if (cashFlowData.length < 2) return 0;
    const last = cashFlowData[cashFlowData.length - 1]?.receita || 0;
    const prev = cashFlowData[cashFlowData.length - 2]?.receita || 0;
    return prev > 0 ? ((last - prev) / prev) * 100 : 0;
  }, [cashFlowData]);

  const gaugeData = useMemo(() => [
    { name: 'Taxa', value: collectionRate, fill: 'hsl(142, 70%, 45%)' },
  ], [collectionRate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Financeiro</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Dashboard • Cobranças • Contas</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span>Atualizado em tempo real</span>
        </div>
      </div>

      {/* ===== KPI Row 1 - Main metrics ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Receita Mensal */}
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-card to-primary/[0.03] p-4 group hover:border-primary/40 transition-all duration-300">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-primary/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Receita Mensal</span>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(totalMonthlyRevenue)}</p>
          <div className="flex items-center gap-1 mt-1">
            <FileText className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-mono">{(clients as any[]).filter(c => c.status === 'active').length} clientes</span>
          </div>
        </div>

        {/* Recebido */}
        <div className="relative overflow-hidden rounded-xl border border-success/20 bg-gradient-to-br from-card to-success/[0.03] p-4 group hover:border-success/40 transition-all duration-300">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-success/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-success/15 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5 text-success" />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Recebido</span>
          </div>
          <p className="text-xl font-bold font-mono text-success">{formatCurrency(totalReceita)}</p>
          {monthlyTrend !== 0 && (
            <div className="flex items-center gap-1 mt-1">
              {monthlyTrend > 0 ? <TrendingUp className="w-3 h-3 text-success" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
              <span className={`text-[10px] font-mono ${monthlyTrend > 0 ? 'text-success' : 'text-destructive'}`}>{monthlyTrend > 0 ? '+' : ''}{monthlyTrend.toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Pendente */}
        <div className="relative overflow-hidden rounded-xl border border-warning/20 bg-gradient-to-br from-card to-warning/[0.03] p-4 group hover:border-warning/40 transition-all duration-300">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-warning/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-warning/15 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-warning" />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Pendente</span>
          </div>
          <p className="text-xl font-bold font-mono text-warning">{formatCurrency(totalPendente)}</p>
          <span className="text-[10px] text-muted-foreground font-mono">{invoices.filter((i: any) => i.status === 'pending').length} faturas</span>
        </div>

        {/* Inadimplência */}
        <div className="relative overflow-hidden rounded-xl border border-destructive/20 bg-gradient-to-br from-card to-destructive/[0.03] p-4 group hover:border-destructive/40 transition-all duration-300">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-destructive/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Atrasado</span>
          </div>
          <p className="text-xl font-bold font-mono text-destructive">{formatCurrency(totalAtrasado)}</p>
          <span className="text-[10px] text-destructive/80 font-mono">{overdueRate.toFixed(1)}% da carteira</span>
        </div>

        {/* Lucro Líquido */}
        <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br from-card p-4 group transition-all duration-300 col-span-2 lg:col-span-1 ${netProfit >= 0 ? 'border-success/20 to-success/[0.03] hover:border-success/40' : 'border-destructive/20 to-destructive/[0.03] hover:border-destructive/40'}`}>
          <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full group-hover:scale-150 transition-transform duration-500 ${netProfit >= 0 ? 'bg-success/5' : 'bg-destructive/5'}`} />
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${netProfit >= 0 ? 'bg-success/15' : 'bg-destructive/15'}`}>
              <PiggyBank className={`w-3.5 h-3.5 ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`} />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Lucro Líquido</span>
          </div>
          <p className={`text-xl font-bold font-mono ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(netProfit)}</p>
          <span className="text-[10px] text-muted-foreground font-mono">Receitas - Despesas</span>
        </div>
      </div>

      {/* ===== Charts Row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Cash Flow - Line Chart */}
        <div className="lg:col-span-7 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Fluxo de Caixa
              </h3>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">Receitas vs Despesas • Últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /><span className="text-[10px] font-mono text-muted-foreground">Receita</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-warning" /><span className="text-[10px] font-mono text-muted-foreground">Despesa</span></div>
            </div>
          </div>
          {cashFlowData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={cashFlowData}>
                <defs>
                  <linearGradient id="gradReceita2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(175, 80%, 45%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(175, 80%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 15%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(220, 18%, 10%)', border: '1px solid hsl(220, 15%, 20%)', borderRadius: 12, fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                <Area type="monotone" dataKey="receita" fill="url(#gradReceita2)" stroke="none" />
                <Line type="monotone" dataKey="receita" stroke="hsl(175, 80%, 45%)" strokeWidth={2.5} dot={{ fill: 'hsl(175, 80%, 45%)', r: 4, strokeWidth: 2, stroke: 'hsl(220, 18%, 10%)' }} activeDot={{ r: 6, strokeWidth: 2 }} name="Receita" />
                <Bar dataKey="despesa" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} barSize={24} opacity={0.7} name="Despesa" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-xs font-mono">Dados insuficientes para gráfico</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Adicione cobranças e contas para visualizar</p>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Gauge + Donut */}
        <div className="lg:col-span-5 grid grid-rows-2 gap-4">
          {/* Collection Rate Gauge */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Taxa de Cobrança
                </h3>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">Eficiência de recebimento</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold font-mono text-primary">{collectionRate.toFixed(1)}%</p>
              </div>
            </div>
            <div className="relative mt-3">
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${Math.min(collectionRate, 100)}%`,
                    background: collectionRate >= 80
                      ? 'linear-gradient(90deg, hsl(142, 70%, 45%), hsl(160, 70%, 40%))'
                      : collectionRate >= 50
                        ? 'linear-gradient(90deg, hsl(38, 92%, 50%), hsl(45, 92%, 50%))'
                        : 'linear-gradient(90deg, hsl(0, 72%, 50%), hsl(15, 72%, 50%))',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] font-mono text-muted-foreground">0%</span>
                <span className="text-[9px] font-mono text-muted-foreground">50%</span>
                <span className="text-[9px] font-mono text-muted-foreground">100%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="text-center p-2 rounded-lg bg-success/5 border border-success/10">
                <p className="text-xs font-bold font-mono text-success">{invoices.filter((i: any) => i.status === 'paid').length}</p>
                <p className="text-[9px] text-muted-foreground">Pagas</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-warning/5 border border-warning/10">
                <p className="text-xs font-bold font-mono text-warning">{invoices.filter((i: any) => i.status === 'pending').length}</p>
                <p className="text-[9px] text-muted-foreground">Pendentes</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                <p className="text-xs font-bold font-mono text-destructive">{invoices.filter((i: any) => i.status === 'overdue').length}</p>
                <p className="text-[9px] text-muted-foreground">Atrasadas</p>
              </div>
            </div>
          </div>

          {/* Expense breakdown mini */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Percent className="w-4 h-4 text-warning" />
                Despesas por Categoria
              </h3>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">Total: {formatCurrency(totalDespesas)}</p>
            </div>
            {expenseByCategory.length > 0 ? (
              <div className="space-y-2.5">
                {expenseByCategory.sort((a, b) => b.value - a.value).slice(0, 5).map((cat, i) => {
                  const pct = totalDespesas > 0 ? (cat.value / totalDespesas) * 100 : 0;
                  const colors = ['hsl(175, 80%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(142, 70%, 45%)', 'hsl(0, 72%, 50%)'];
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                          <span className="text-[11px] text-foreground">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground">{pct.toFixed(0)}%</span>
                          <span className="text-[11px] font-mono text-foreground">{formatCurrency(cat.value)}</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-20 text-muted-foreground">
                <p className="text-[11px] font-mono">Nenhuma despesa registrada</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Tabs: Contas a Receber / Pagar ===== */}
      <Tabs defaultValue="receivables" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="receivables" className="gap-2"><Receipt className="w-4 h-4" />Contas a Receber</TabsTrigger>
          <TabsTrigger value="payables" className="gap-2"><CreditCard className="w-4 h-4" />Contas a Pagar</TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="space-y-4">
          <div className="flex items-center justify-between">
            <div />
            <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setErrors({}); setDialogOpen(v); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Cobrança</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle className="text-foreground">Nova Cobrança</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Cliente *</Label>
                    <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                      <SelectTrigger className={`bg-muted border-border ${errors.clientId ? 'border-destructive' : ''}`}><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                      <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.clientId && <p className="text-[10px] text-destructive mt-1">{errors.clientId}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor (R$) *</Label>
                      <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="1500.00" className={`bg-muted border-border font-mono ${errors.amount ? 'border-destructive' : ''}`} />
                      {errors.amount && <p className="text-[10px] text-destructive mt-1">{errors.amount}</p>}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Vencimento *</Label>
                      <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} className={`bg-muted border-border font-mono ${errors.dueDate ? 'border-destructive' : ''}`} />
                      {errors.dueDate && <p className="text-[10px] text-destructive mt-1">{errors.dueDate}</p>}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Banco *</Label>
                    <Select value={form.bank} onValueChange={v => setForm(p => ({ ...p, bank: v }))}>
                      <SelectTrigger className={`bg-muted border-border ${errors.bank ? 'border-destructive' : ''}`}><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                      <SelectContent>
                        {activeBanks.length > 0 ? activeBanks.map(bank => <SelectItem key={bank} value={bank}>{bankLabels[bank] || bank}</SelectItem>) : (
                          <>
                            <SelectItem value="sicredi">Sicredi</SelectItem>
                            <SelectItem value="caixa">Caixa Econômica</SelectItem>
                            <SelectItem value="banco_do_brasil">Banco do Brasil</SelectItem>
                            <SelectItem value="inter">Banco Inter</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.bank && <p className="text-[10px] text-destructive mt-1">{errors.bank}</p>}
                  </div>
                  <Button onClick={handleSave} className="w-full">Gerar Cobrança</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

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

          <div className="rounded-xl border border-border overflow-hidden">
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
                {filtered.map((inv: any) => {
                  const st = statusConfig[inv.status] || statusConfig.pending;
                  const StatusIcon = st.icon;
                  return (
                    <tr key={inv.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{inv.client_name}</p></td>
                      <td className="px-4 py-3"><p className="text-sm font-mono text-foreground">{formatCurrency(Number(inv.amount))}</p></td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono text-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('pt-BR') : '-'}</p>
                        {inv.paid_at && <p className="text-[10px] text-muted-foreground">Pago em {new Date(inv.paid_at).toLocaleDateString('pt-BR')}</p>}
                      </td>
                      <td className="px-4 py-3"><p className="text-xs text-foreground">{inv.bank ? bankLabels[inv.bank] || inv.bank : '-'}</p></td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full ${st.className}`}>
                          <StatusIcon className="w-3 h-3" />{st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status !== 'paid' && !inv.boleto_url && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary hover:text-primary" onClick={() => handleSendBoleto(inv)} disabled={sendingBoleto === inv.id}>
                              <Send className="w-3 h-3" /> {sendingBoleto === inv.id ? 'Enviando...' : 'Registrar Boleto'}
                            </Button>
                          )}
                          {inv.boleto_url && inv.status !== 'paid' && (
                            <>
                              <span className="text-[10px] font-mono text-success mr-1">✓ Registrado</span>
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-warning hover:text-warning" onClick={() => handleCancelBoleto(inv)}>
                                <XCircle className="w-3 h-3" /> Cancelar
                              </Button>
                            </>
                          )}
                          {!inv.boleto_url && inv.status !== 'paid' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => handleDeleteInvoice(inv.id)}>
                              <Trash2 className="w-3 h-3" /> Deletar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <DollarSign className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-mono">Nenhuma cobrança encontrada</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payables" className="space-y-4">
          <div className="flex items-center justify-between">
            <div />
            <Button className="gap-2" onClick={openAddBill}><Plus className="w-4 h-4" /> Nova Conta</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Total Pago</span>
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
              <p className="text-xl font-bold font-mono text-success">{formatCurrency(totalBillsPaid)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">A Pagar</span>
                <Clock className="w-4 h-4 text-warning" />
              </div>
              <p className="text-xl font-bold font-mono text-warning">{formatCurrency(totalBillsPending)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Atrasado</span>
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <p className="text-xl font-bold font-mono text-destructive">{formatCurrency(totalBillsOverdue)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={billSearch} onChange={e => setBillSearch(e.target.value)} placeholder="Buscar conta..." className="pl-9 bg-muted border-border" />
            </div>
            <Select value={billFilterStatus} onValueChange={setBillFilterStatus}>
              <SelectTrigger className="w-36 bg-muted border-border"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="overdue">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Descrição</th>
                  <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Categoria</th>
                  <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Fornecedor</th>
                  <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Valor</th>
                  <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Vencimento</th>
                  <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill: any) => {
                  const st = statusConfig[bill.status] || statusConfig.pending;
                  const StatusIcon = st.icon;
                  return (
                    <tr key={bill.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{bill.description}</p>
                        {bill.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{bill.notes}</p>}
                      </td>
                      <td className="px-4 py-3"><p className="text-xs text-foreground">{billCategories[bill.category] || bill.category}</p></td>
                      <td className="px-4 py-3"><p className="text-xs text-foreground">{bill.supplier || '-'}</p></td>
                      <td className="px-4 py-3"><p className="text-sm font-mono text-foreground">{formatCurrency(Number(bill.amount))}</p></td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono text-foreground">{bill.due_date ? new Date(bill.due_date).toLocaleDateString('pt-BR') : '-'}</p>
                        {bill.paid_at && <p className="text-[10px] text-muted-foreground">Pago em {new Date(bill.paid_at).toLocaleDateString('pt-BR')}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full ${st.className}`}>
                          <StatusIcon className="w-3 h-3" />{st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {bill.status !== 'paid' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-success hover:text-success" onClick={() => handlePayBill(bill)}>
                              <CheckCircle className="w-3 h-3" /> Pagar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openEditBill(bill)}>
                            <Edit className="w-3 h-3" /> Editar
                          </Button>
                          {bill.status !== 'paid' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => handleDeleteBill(bill.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!billsLoading && filteredBills.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CreditCard className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-mono">Nenhuma conta a pagar encontrada</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bill Dialog */}
      <Dialog open={billDialogOpen} onOpenChange={(v) => { if (!v) { setBillErrors({}); setEditingBill(null); } setBillDialogOpen(v); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">{editingBill ? 'Editar Conta' : 'Nova Conta a Pagar'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Descrição *</Label>
              <Input value={billForm.description} onChange={e => setBillForm(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Aluguel do escritório" className={`bg-muted border-border ${billErrors.description ? 'border-destructive' : ''}`} />
              {billErrors.description && <p className="text-[10px] text-destructive mt-1">{billErrors.description}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select value={billForm.category} onValueChange={v => setBillForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(billCategories).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                <Input value={billForm.supplier} onChange={e => setBillForm(p => ({ ...p, supplier: e.target.value }))} placeholder="Nome do fornecedor" className="bg-muted border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Valor (R$) *</Label>
                <Input type="number" value={billForm.amount} onChange={e => setBillForm(p => ({ ...p, amount: e.target.value }))} placeholder="500.00" className={`bg-muted border-border font-mono ${billErrors.amount ? 'border-destructive' : ''}`} />
                {billErrors.amount && <p className="text-[10px] text-destructive mt-1">{billErrors.amount}</p>}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Vencimento *</Label>
                <Input type="date" value={billForm.dueDate} onChange={e => setBillForm(p => ({ ...p, dueDate: e.target.value }))} className={`bg-muted border-border font-mono ${billErrors.dueDate ? 'border-destructive' : ''}`} />
                {billErrors.dueDate && <p className="text-[10px] text-destructive mt-1">{billErrors.dueDate}</p>}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea value={billForm.notes} onChange={e => setBillForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas adicionais..." className="bg-muted border-border text-sm" rows={2} />
            </div>
            <Button onClick={handleSaveBill} className="w-full">{editingBill ? 'Salvar Alterações' : 'Adicionar Conta'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Financial;
