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
import { Plus, Copy, Users, DollarSign, Percent, Link2 } from 'lucide-react';

interface Seller {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
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

const Sales = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', cpf: '', phone: '', email: '', commission_percent: '10' });

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

  const createSeller = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sellers').insert({
        name: form.name,
        cpf: form.cpf || null,
        phone: form.phone || null,
        email: form.email || null,
        commission_percent: parseFloat(form.commission_percent) || 10,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      setOpen(false);
      setForm({ name: '', cpf: '', phone: '', email: '', commission_percent: '10' });
      toast({ title: 'Vendedor cadastrado com sucesso!' });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const getSellerClients = (sellerId: string) => clients.filter(c => c.seller_id === sellerId && c.status === 'active');

  const getSellerCommission = (seller: Seller) => {
    const sellerClients = getSellerClients(seller.id);
    return sellerClients.reduce((sum, c) => sum + (c.monthly_fee || 0) * (seller.commission_percent / 100), 0);
  };

  const totalCommissions = sellers.reduce((sum, s) => sum + getSellerCommission(s), 0);
  const totalActiveClients = sellers.reduce((sum, s) => sum + getSellerClients(s.id).length, 0);

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/indicacao/${code}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendedores & Indicações</h1>
          <p className="text-muted-foreground text-sm">Gerencie vendedores, links de indicação e comissões</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Vendedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Vendedor</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Comissão (%)</Label><Input type="number" value={form.commission_percent} onChange={e => setForm({ ...form, commission_percent: e.target.value })} /></div>
              <Button onClick={() => createSeller.mutate()} disabled={!form.name || createSeller.isPending} className="w-full">
                {createSeller.isPending ? 'Salvando...' : 'Cadastrar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Vendedores Ativos</p>
              <p className="text-2xl font-bold">{sellers.filter(s => s.status === 'active').length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10"><Percent className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Clientes por Indicação</p>
              <p className="text-2xl font-bold">{totalActiveClients}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Comissões Mensais</p>
              <p className="text-2xl font-bold">R$ {totalCommissions.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sellers Table */}
      <Card>
        <CardHeader><CardTitle>Vendedores</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Clientes Ativos</TableHead>
                <TableHead>Valor Mensal</TableHead>
                <TableHead>Link de Indicação</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum vendedor cadastrado</TableCell></TableRow>
              ) : sellers.map(seller => {
                const sellerClients = getSellerClients(seller.id);
                const commission = getSellerCommission(seller);
                return (
                  <TableRow key={seller.id}>
                    <TableCell className="font-medium">{seller.name}</TableCell>
                    <TableCell>{seller.phone || '—'}</TableCell>
                    <TableCell>{seller.commission_percent}%</TableCell>
                    <TableCell>{sellerClients.length}</TableCell>
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
          <CardHeader>
            <CardTitle className="text-base">Clientes de {seller.name} ({seller.commission_percent}%)</CardTitle>
          </CardHeader>
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
