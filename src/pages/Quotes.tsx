import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Plus, FileText, Search, Trash2, Eye, ShoppingCart, Download } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { generateQuotePdf } from '@/lib/generateQuotePdf';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'default' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
};

interface QuoteItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

const Quotes = () => {
  const queryClient = useQueryClient();
  const { data: company } = useCompanySettings();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewQuote, setViewQuote] = useState<any>(null);
  const [form, setForm] = useState({ client_id: '', client_name: '', notes: '', valid_until: '', discount: 0 });
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [search, setSearch] = useState('');

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').is('deleted_at', null).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('status', 'active').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: quoteItems = [] } = useQuery({
    queryKey: ['quote_items', viewQuote?.id],
    queryFn: async () => {
      if (!viewQuote?.id) return [];
      const { data, error } = await supabase.from('quote_items').select('*').eq('quote_id', viewQuote.id);
      if (error) throw error;
      return data;
    },
    enabled: !!viewQuote?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const total = items.reduce((s, i) => s + i.total, 0) - form.discount;
      const client = clients.find((c: any) => c.id === form.client_id);
      const { data: quote, error } = await supabase.from('quotes').insert({
        client_id: form.client_id || null,
        client_name: client?.name || form.client_name || null,
        notes: form.notes || null,
        valid_until: form.valid_until || null,
        discount: form.discount,
        total,
      }).select().single();
      if (error) throw error;

      if (items.length > 0) {
        const { error: itemsError } = await supabase.from('quote_items').insert(
          items.map(i => ({ quote_id: quote.id, product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, total: i.total }))
        );
        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Orçamento criado com sucesso' });
      setDialogOpen(false);
      setForm({ client_id: '', client_name: '', notes: '', valid_until: '', discount: 0 });
      setItems([]);
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Orçamento excluído' });
    },
  });

  const addProduct = (product: any) => {
    const existing = items.find(i => i.product_id === product.id);
    if (existing) {
      setItems(items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price } : i));
    } else {
      setItems([...items, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: Number(product.sale_price), total: Number(product.sale_price) }]);
    }
    setProductSearch('');
  };

  const updateItemQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    setItems(items.map((item, i) => i === idx ? { ...item, quantity: qty, total: qty * item.unit_price } : item));
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const grandTotal = subtotal - form.discount;

  const filteredProducts = products.filter((p: any) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const filteredQuotes = quotes.filter((q: any) =>
    (q.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (q.quote_number || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie orçamentos para clientes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setForm({ client_id: '', client_name: '', notes: '', valid_until: '', discount: 0 }); setItems([]); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Orçamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={form.client_id} onValueChange={v => { const c = clients.find((c: any) => c.id === v); setForm({ ...form, client_id: v, client_name: c?.name || '' }); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Validade</Label>
                  <Input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
                </div>
              </div>

              {/* Product search and add */}
              <div className="space-y-2">
                <Label>Adicionar Produtos</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar produto pelo nome ou SKU..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                </div>
                {productSearch && filteredProducts.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto bg-popover">
                    {filteredProducts.slice(0, 10).map((p: any) => (
                      <button key={p.id} onClick={() => addProduct(p)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent text-sm text-left">
                        <span>{p.name} {p.sku && <span className="text-muted-foreground">({p.sku})</span>}</span>
                        <span className="font-medium text-primary">R$ {Number(p.sale_price).toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {productSearch && filteredProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">Nenhum produto encontrado</p>
                )}
              </div>

              {/* Items table */}
              {items.length > 0 && (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-24 text-center">Qtd</TableHead>
                        <TableHead className="text-right">Unitário</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-center">
                            <Input type="number" min={1} className="w-20 text-center mx-auto" value={item.quantity} onChange={e => updateItemQty(idx, Number(e.target.value))} />
                          </TableCell>
                          <TableCell className="text-right">R$ {item.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">R$ {item.total.toFixed(2)}</TableCell>
                          <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Desconto (R$)</Label>
                  <Input type="number" step="0.01" value={form.discount} onChange={e => setForm({ ...form, discount: Number(e.target.value) })} />
                </div>
                <div className="flex flex-col justify-end">
                  <p className="text-sm text-muted-foreground">Subtotal: R$ {subtotal.toFixed(2)}</p>
                  <p className="text-lg font-bold text-foreground">Total: R$ {grandTotal.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Condições, prazo de entrega..." />
              </div>

              <Button onClick={() => { if (items.length === 0) return toast({ title: 'Adicione ao menos um produto', variant: 'destructive' }); saveMutation.mutate(); }} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : 'Criar Orçamento'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary" />
          <div><p className="text-sm text-muted-foreground">Total de Orçamentos</p><p className="text-2xl font-bold text-foreground">{quotes.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-green-500" />
          <div><p className="text-sm text-muted-foreground">Aprovados</p><p className="text-2xl font-bold text-foreground">{quotes.filter((q: any) => q.status === 'approved').length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <FileText className="w-8 h-8 text-yellow-500" />
          <div><p className="text-sm text-muted-foreground">Pendentes</p><p className="text-2xl font-bold text-foreground">{quotes.filter((q: any) => q.status === 'draft' || q.status === 'sent').length}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Orçamentos</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar orçamento..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground text-center py-8">Carregando...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-sm">{q.quote_number}</TableCell>
                    <TableCell className="font-medium">{q.client_name || '-'}</TableCell>
                    <TableCell><Badge variant={STATUS_MAP[q.status]?.variant || 'outline'}>{STATUS_MAP[q.status]?.label || q.status}</Badge></TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(q.total).toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(q.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewQuote(q)}><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredQuotes.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum orçamento encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View quote dialog */}
      <Dialog open={!!viewQuote} onOpenChange={o => { if (!o) setViewQuote(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Orçamento {viewQuote?.quote_number}</DialogTitle></DialogHeader>
          {viewQuote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> {viewQuote.client_name || '-'}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={STATUS_MAP[viewQuote.status]?.variant || 'outline'}>{STATUS_MAP[viewQuote.status]?.label || viewQuote.status}</Badge></div>
                <div><span className="text-muted-foreground">Criado:</span> {new Date(viewQuote.created_at).toLocaleDateString('pt-BR')}</div>
                {viewQuote.valid_until && <div><span className="text-muted-foreground">Validade:</span> {new Date(viewQuote.valid_until).toLocaleDateString('pt-BR')}</div>}
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-center">Qtd</TableHead><TableHead className="text-right">Unit.</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {quoteItems.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.product_name}</TableCell>
                      <TableCell className="text-center">{i.quantity}</TableCell>
                      <TableCell className="text-right">R$ {Number(i.unit_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">R$ {Number(i.total).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {viewQuote.discount > 0 && <p className="text-sm text-muted-foreground text-right">Desconto: -R$ {Number(viewQuote.discount).toFixed(2)}</p>}
              <p className="text-right text-lg font-bold">Total: R$ {Number(viewQuote.total).toFixed(2)}</p>
              {viewQuote.notes && <p className="text-sm text-muted-foreground border-t pt-2">{viewQuote.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Quotes;
