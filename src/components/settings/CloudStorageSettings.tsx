import { useState } from 'react';
import { Cloud, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';

const PROVIDERS = [
  { value: 'r2', label: 'Cloudflare R2' },
  { value: 'eveo', label: 'Eveo' },
  { value: 'custom', label: 'Outro servidor (S3 compatível)' },
];

interface Form {
  name: string;
  provider: string;
  bucket: string;
  endpoint: string;
  region: string;
  access_key_id: string;
  secret_access_key: string;
  public_base_url: string;
  base_path: string;
  status: string;
}

const emptyForm: Form = {
  name: '', provider: 'r2', bucket: '', endpoint: '', region: 'auto',
  access_key_id: '', secret_access_key: '', public_base_url: '', base_path: 'gravacoes', status: 'active',
};

const CloudStorageSettings = () => {
  const { toast } = useToast();
  const { data: storages = [], isLoading } = useTableQuery('cloud_storages', 'created_at');
  const insertMutation = useInsertMutation('cloud_storages');
  const updateMutation = useUpdateMutation('cloud_storages');
  const deleteMutation = useDeleteMutation('cloud_storages');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ ...emptyForm });

  const reset = () => { setForm({ ...emptyForm }); setEditingId(null); setOpen(false); };

  const providerLabel = (v: string) => PROVIDERS.find(p => p.value === v)?.label || v;

  const handleProvider = (provider: string) => {
    setForm(p => ({
      ...p,
      provider,
      region: provider === 'r2' ? 'auto' : p.region,
      endpoint: provider === 'r2' && !p.endpoint ? 'https://<account_id>.r2.cloudflarestorage.com' : p.endpoint,
    }));
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.bucket.trim() || !form.endpoint.trim()) {
      toast({ title: 'Preencha nome, bucket e endereço do serviço', variant: 'destructive' });
      return;
    }
    const payload = { ...form, name: form.name.trim() };
    const mutation = editingId ? updateMutation : insertMutation;
    const data = editingId ? { id: editingId, ...payload } : payload;
    mutation.mutate(data as any, {
      onSuccess: () => { toast({ title: editingId ? 'Armazenamento atualizado' : 'Armazenamento adicionado' }); reset(); },
      onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
    });
  };

  const handleEdit = (s: any) => {
    setEditingId(s.id);
    setForm({
      name: s.name || '', provider: s.provider || 'r2', bucket: s.bucket || '', endpoint: s.endpoint || '',
      region: s.region || 'auto', access_key_id: s.access_key_id || '', secret_access_key: s.secret_access_key || '',
      public_base_url: s.public_base_url || '', base_path: s.base_path || '', status: s.status || 'active',
    });
    setOpen(true);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="w-4 h-4 text-primary" />
            Armazenamento em Nuvem
          </CardTitle>
          <CardDescription className="text-xs">
            Cadastre os destinos na nuvem (Cloudflare R2, Eveo ou outro servidor) para guardar as imagens das câmeras
          </CardDescription>
        </div>
        <Button size="sm" className="gap-1" onClick={() => { setEditingId(null); setForm({ ...emptyForm }); setOpen(true); }}>
          <Plus className="w-4 h-4" /> Novo Destino
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(storages as any[]).map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-sm">{providerLabel(s.provider)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.bucket}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[220px]">{s.endpoint}</TableCell>
                <TableCell>
                  <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>
                    {s.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(s)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && (storages as any[]).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  <Cloud className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Nenhum destino em nuvem cadastrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); else setOpen(true); }}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Destino' : 'Novo Destino em Nuvem'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Serviço *</Label>
              <Select value={form.provider} onValueChange={handleProvider}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nome *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nuvem principal" className="bg-muted border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Bucket *</Label>
                <Input value={form.bucket} onChange={e => setForm(p => ({ ...p, bucket: e.target.value }))} placeholder="gravacoes" className="bg-muted border-border font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Região</Label>
                <Input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} placeholder="auto" className="bg-muted border-border font-mono text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Endereço do serviço *</Label>
              <Input value={form.endpoint} onChange={e => setForm(p => ({ ...p, endpoint: e.target.value }))} placeholder="https://xxxx.r2.cloudflarestorage.com" className="bg-muted border-border font-mono text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Chave de acesso</Label>
                <Input value={form.access_key_id} onChange={e => setForm(p => ({ ...p, access_key_id: e.target.value }))} className="bg-muted border-border font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Chave secreta</Label>
                <Input type="password" value={form.secret_access_key} onChange={e => setForm(p => ({ ...p, secret_access_key: e.target.value }))} className="bg-muted border-border font-mono text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Pasta base</Label>
                <Input value={form.base_path} onChange={e => setForm(p => ({ ...p, base_path: e.target.value }))} placeholder="gravacoes" className="bg-muted border-border font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">URL pública (opcional)</Label>
              <Input value={form.public_base_url} onChange={e => setForm(p => ({ ...p, public_base_url: e.target.value }))} placeholder="https://cdn.suaempresa.com" className="bg-muted border-border font-mono text-xs" />
            </div>
            <Button className="w-full" onClick={handleSave}>{editingId ? 'Salvar Alterações' : 'Adicionar Destino'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CloudStorageSettings;
