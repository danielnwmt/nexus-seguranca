import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Plus, Copy, Users, DollarSign, Percent, Link2, Edit, TrendingUp, BarChart3 } from 'lucide-react';
import { maskCpf, maskPhone } from '@/lib/masks';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Seller {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  commission_percent: number;
  referral_code: string;
  status: string;
  created_at: string;
}

interface ClientWithSeller {
  id: string;
  name: string;
  monthly_fee: number | null;
  status: string;
  seller_id: string | null;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const emptyForm = { name: '', cpf: '', phone: '', email: '', address: '', commission_percent: '10' };

const Sales = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sellers').select('*').order('name');
      if (error) throw error;
      return data as Seller[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients_with_seller'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, monthly_fee, status, seller_id').not('seller_id', 'is', null);
      if (error) throw error;
      return data as ClientWithSeller[];
    },
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['all_clients_financial'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, monthly_fee, status');
      if (error) throw error;
      return data as ClientWithSeller[];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('id, amount, status, due_date, paid_at').order('due_date', { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const createSeller = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sellers').insert({
        name: form.name,
        cpf: form.cpf || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        commission_percent: parseFloat(form.commission_percent) || 10,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      setOpen(false);
      setForm(emptyForm);
      toast({ title: 'Vendedor cadastrado com sucesso!' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const updateSeller = useMutation({
    mutationFn: async () => {
      if (!editingSeller) return;
      const { error } = await supabase.from('sellers').update({
        name: form.name,
        cpf: form.cpf || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        commission_percent: parseFloat(form.commission_percent) || 10,
      }).eq('id', editingSeller.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      setEditOpen(false);
      setEditingSeller(null);
      setForm(emptyForm);
      toast({ title: 'Vendedor atualizado!' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const openEdit = (seller: Seller) => {
    setEditingSeller(seller);
    setForm({
      name: seller.name,
      cpf: seller.cpf || '',
      phone: seller.phone || '',
      email: seller.email || '',
      address: seller.address || '',
      commission_percent: String(seller.commission_percent),
    });
    setEditOpen(true);
  };

  const getSellerClients = (sellerId: string) => clients.filter(c => c.seller_id === sellerId && c.status === 'active');

  const getSellerCommission = (seller: Seller) => {
    const sc = getSellerClients(seller.id);
    return sc.reduce((sum, c) => sum + (c.monthly_fee || 0) * (seller.commission_percent / 100), 0);
  };

  const totalCommissions = sellers.reduce((sum, s) => sum + getSellerCommission(s), 0);
  const totalActiveClients = sellers.reduce((sum, s) => sum + getSellerClients(s.id).length, 0);
  const totalRevenue = allClients.filter(c => c.status === 'active').reduce((sum, c) => sum + (c.monthly_fee || 0), 0);
  const paidInvoices = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0);
  const pendingInvoices = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + (i.amount || 0), 0);
  const overdueInvoices = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.amount || 0), 0);

  // Chart data
  const sellerChartData = sellers.filter(s => s.status === 'active').map(s => ({
    name: s.name.split(' ')[0],
    clientes: getSellerClients(s.id).length,
    comissao: getSellerCommission(s),
  }));

  const invoiceStatusData = [
    { name: 'Pago', value: paidInvoices },
    { name: 'Pendente', value: pendingInvoices },
    { name: 'Atrasado', value: overdueInvoices },
  ].filter(d => d.value > 0);

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/indicacao/${code}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!' });
  };

  const SellerFormFields = () => (
    <div className="space-y-4">
      <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm({ ...form, cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" /></div>
      <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" /></div>
      <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
      <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Rua, nº, Bairro, Cidade - UF" /></div>
      <div><Label>Comissão (%)</Label><Input type="number" value={form.commission_percent} onChange={e => setForm({ ...form, commission_percent: e.target.value })} /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendedores & Financeiro</h1>
          <p className="text-muted-foreground text-sm">Dashboard financeiro, vendedores e comissões</p>
        </div>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Vendedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Vendedor</DialogTitle></DialogHeader>
            <SellerFormFields />
            <Button onClick={() => createSeller.mutate()} disabled={!form.name || createSeller.isPending} className="w-full">
              {createSeller.isPending ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Financial Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10"><TrendingUp className="w-5 h-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Receita Mensal</p><p className="text-2xl font-bold">R$ {totalRevenue.toFixed(2)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-500/10"><DollarSign className="w-5 h-5 text-green-500" /></div>
          <div><p className="text-sm text-muted-foreground">Recebido</p><p className="text-2xl font-bold text-green-500">R$ {paidInvoices.toFixed(2)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-500/10"><DollarSign className="w-5 h-5 text-yellow-500" /></div>
          <div><p className="text-sm text-muted-foreground">Pendente</p><p className="text-2xl font-bold text-yellow-500">R$ {pendingInvoices.toFixed(2)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-destructive/10"><DollarSign className="w-5 h-5 text-destructive" /></div>
          <div><p className="text-sm text-muted-foreground">Atrasado</p><p className="text-2xl font-bold text-destructive">R$ {overdueInvoices.toFixed(2)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10"><Percent className="w-5 h-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Comissões</p><p className="text-2xl font-bold">R$ {totalCommissions.toFixed(2)}</p></div>
        </CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sellerChartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" />Comissões por Vendedor</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sellerChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-muted-foreground" tick={{ fontSize: 12 }} />
                  <YAxis className="text-muted-foreground" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Bar dataKey="comissao" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Comissão" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {invoiceStatusData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" />Faturas por Status</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={invoiceStatusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: R$${value.toFixed(0)}`}>
                    {invoiceStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Seller stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Vendedores Ativos</p><p className="text-2xl font-bold">{sellers.filter(s => s.status === 'active').length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Clientes por Indicação</p><p className="text-2xl font-bold">{totalActiveClients}</p></div>
        </CardContent></Card>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={o => { setEditOpen(o); if (!o) { setEditingSeller(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Vendedor</DialogTitle></DialogHeader>
          <SellerFormFields />
          <Button onClick={() => updateSeller.mutate()} disabled={!form.name || updateSeller.isPending} className="w-full">
            {updateSeller.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Sellers Table */}
      <Card>
        <CardHeader><CardTitle>Vendedores</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Valor Mensal</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhum vendedor cadastrado</TableCell></TableRow>
              ) : sellers.map(seller => {
                const sc = getSellerClients(seller.id);
                const commission = getSellerCommission(seller);
                return (
                  <TableRow key={seller.id}>
                    <TableCell className="font-medium">{seller.name}</TableCell>
                    <TableCell className="font-mono text-xs">{seller.cpf || '—'}</TableCell>
                    <TableCell>{seller.phone || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{seller.address || '—'}</TableCell>
                    <TableCell>{seller.commission_percent}%</TableCell>
                    <TableCell>{sc.length}</TableCell>
                    <TableCell className="text-primary font-semibold">R$ {commission.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => copyLink(seller.referral_code)} className="gap-1">
                        <Link2 className="w-3.5 h-3.5" />
                        <span className="font-mono text-xs">{seller.referral_code}</span>
                        <Copy className="w-3 h-3 ml-1" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={seller.status === 'active' ? 'default' : 'secondary'}>
                        {seller.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(seller)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Clients by seller */}
      {sellers.filter(s => getSellerClients(s.id).length > 0).map(seller => (
        <Card key={seller.id}>
          <CardHeader><CardTitle className="text-base">Clientes de {seller.name} ({seller.commission_percent}%)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Mensalidade</TableHead>
                  <TableHead>Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getSellerClients(seller.id).map(client => (
                  <TableRow key={client.id}>
                    <TableCell>{client.name}</TableCell>
                    <TableCell>R$ {(client.monthly_fee || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-primary font-semibold">R$ {((client.monthly_fee || 0) * seller.commission_percent / 100).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default Sales;
