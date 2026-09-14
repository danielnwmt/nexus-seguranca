import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Bell, Camera, Check, Cloud, Copy, Database, DollarSign, ExternalLink, Pencil, Plus, Settings2, ShieldCheck, Users, Video } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCompanyAccessUrl, getCompanyUrl, normalizeDomain, normalizeSubdomain } from '@/lib/tenantDomain';

interface OwnerStats {
  clients_total: number;
  clients_active: number;
  users_total: number;
  cameras_total: number;
  cameras_online: number;
  alarms_open: number;
  recordings_total: number;
  storage_servers_total: number;
  cloud_storages_total: number;
  monthly_revenue: number;
}

const emptyStats: OwnerStats = {
  clients_total: 0, clients_active: 0, users_total: 0, cameras_total: 0,
  cameras_online: 0, alarms_open: 0, recordings_total: 0,
  storage_servers_total: 0, cloud_storages_total: 0, monthly_revenue: 0,
};

type Company = {
  id: string;
  name: string;
  browser_title: string | null;
  legal_name: string | null;
  document: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  recording_segment_minutes: number;
  plan_name: string;
  status: string;
  subdomain: string;
  domain_type: 'subdomain' | 'custom';
  custom_domain: string | null;
};

type CompanyForm = Omit<Company, 'id' | 'custom_domain' | 'browser_title'> & { custom_domain: string; browser_title: string };

const modules = [
  ['dashboard', 'Dashboard'], ['cameras_view', 'Câmeras, ao vivo e gravações'],
  ['clients_view', 'Clientes'], ['guards', 'Vigilantes'], ['installers', 'Técnicos'],
  ['service_orders', 'Ordens de serviço'], ['financial', 'Financeiro, estoque e orçamentos'],
  ['alarms', 'Alarmes e centrais'], ['analytics', 'Analíticos IA'],
  ['settings', 'Saúde e configurações'], ['support', 'Atendimento'],
] as const;

const blankForm: CompanyForm = { name: '', browser_title: '', legal_name: '', document: '', address: '', email: '', phone: '', logo_url: '', recording_segment_minutes: 30, plan_name: 'Personalizado', status: 'active', subdomain: '', domain_type: 'subdomain', custom_domain: '' };
const blankAccessForm = { name: '', email: '' };

const OwnerDashboard = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [companyDialog, setCompanyDialog] = useState(false);
  const [featuresDialog, setFeaturesDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [form, setForm] = useState(blankForm);
  const [accessForm, setAccessForm] = useState(blankAccessForm);
  const [accessLoading, setAccessLoading] = useState(false);
  const [temporaryAccess, setTemporaryAccess] = useState<{ email: string; password: string } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const { data = emptyStats, isLoading, error } = useQuery({
    queryKey: ['owner-dashboard-stats'],
    queryFn: async () => {
      const { data: result, error: queryError } = await supabase.rpc('get_owner_dashboard_stats');
      if (queryError) throw queryError;
      return { ...emptyStats, ...(result as unknown as Partial<OwnerStats>) };
    },
    refetchInterval: 60_000,
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['saas-companies'],
    queryFn: async () => {
      const { data: result, error: queryError } = await supabase.from('saas_companies').select('*').order('name');
      if (queryError) throw queryError;
      return result as Company[];
    },
  });

  const activeCompanies = useMemo(() => companies.filter((company) => company.status === 'active').length, [companies]);

  const saveCompany = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        name: form.name.trim(),
        browser_title: form.browser_title.trim() || `${form.name.trim()} | Monitoramento`,
        legal_name: form.legal_name.trim() || null,
        document: form.document.trim() || null,
        address: form.address.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        logo_url: form.logo_url || null,
        subdomain: normalizeSubdomain(form.subdomain || form.name),
        domain_type: form.domain_type,
        custom_domain: form.domain_type === 'custom' ? normalizeDomain(form.custom_domain) : null,
      };
      if (!payload.name) throw new Error('Informe o nome da empresa.');
      if (payload.domain_type === 'custom' && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(payload.custom_domain || '')) throw new Error('Informe um domínio válido.');
      let companyId = editingCompany?.id || '';
      if (editingCompany) {
        const { error: updateError } = await supabase.from('saas_companies').update(payload).eq('id', editingCompany.id);
        if (updateError) throw updateError;
      } else {
        const { data: created, error: insertError } = await supabase.from('saas_companies').insert(payload).select('id').single();
        if (insertError) throw insertError;
        companyId = created.id;
        const { error: featureError } = await supabase.from('saas_company_features').insert(modules.map(([module]) => ({ company_id: created.id, module, enabled: true })));
        if (featureError) throw featureError;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada. Entre novamente.');
      const { data: accessResult, error: accessError } = await supabase.functions.invoke('manage-users', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { action: 'save_company_access', company_id: companyId, ...accessForm },
      });
      if (accessError || accessResult?.error) throw new Error(accessResult?.error || 'Não foi possível criar o usuário da empresa.');
      if (accessResult?.temporary_password) {
        setTemporaryAccess({ email: accessForm.email, password: accessResult.temporary_password });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-companies'] });
      setCompanyDialog(false);
      toast({ title: editingCompany ? 'Empresa atualizada' : 'Empresa adicionada' });
    },
    onError: (mutationError: Error) => toast({ title: 'Não foi possível salvar', description: mutationError.message, variant: 'destructive' }),
  });

  const saveFeatures = useMutation({
    mutationFn: async () => {
      if (!selectedCompany) throw new Error('Empresa não selecionada.');
      const { error: upsertError } = await supabase.from('saas_company_features').upsert(
        modules.map(([module]) => ({ company_id: selectedCompany.id, module, enabled: enabledModules.includes(module) })),
        { onConflict: 'company_id,module' },
      );
      if (upsertError) throw upsertError;
    },
    onSuccess: () => {
      setFeaturesDialog(false);
      toast({ title: 'Recursos atualizados' });
    },
    onError: (mutationError: Error) => toast({ title: 'Não foi possível liberar os recursos', description: mutationError.message, variant: 'destructive' }),
  });

  const openNewCompany = () => { setEditingCompany(null); setForm(blankForm); setAccessForm(blankAccessForm); setCompanyDialog(true); };
  const openEditCompany = async (company: Company) => {
    setEditingCompany(company);
    setForm({ name: company.name, browser_title: company.browser_title || `${company.name} | Monitoramento`, legal_name: company.legal_name || '', document: company.document || '', address: company.address || '', email: company.email || '', phone: company.phone || '', logo_url: company.logo_url || '', recording_segment_minutes: company.recording_segment_minutes || 30, plan_name: company.plan_name, status: company.status, subdomain: company.subdomain, domain_type: company.domain_type || 'subdomain', custom_domain: company.custom_domain || '' });
    setAccessForm(blankAccessForm);
    setCompanyDialog(true);
    setAccessLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) { setAccessLoading(false); return; }
    const { data: accessResult } = await supabase.functions.invoke('manage-users', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { action: 'get_company_access', company_id: company.id },
    });
    if (accessResult?.user) setAccessForm({ name: accessResult.user.name || '', email: accessResult.user.email || '' });
    setAccessLoading(false);
  };
  const openFeatures = async (company: Company) => {
    const { data: features, error: featureError } = await supabase.from('saas_company_features').select('module, enabled').eq('company_id', company.id);
    if (featureError) { toast({ title: 'Não foi possível carregar os recursos', variant: 'destructive' }); return; }
    setSelectedCompany(company);
    setEnabledModules(features?.filter((feature) => feature.enabled).map((feature) => feature.module) || []);
    setFeaturesDialog(true);
  };

  const handleCompanySubmit = (event: FormEvent) => { event.preventDefault(); saveCompany.mutate(); };
  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Logo muito grande', description: 'O tamanho máximo é 2 MB.', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, logo_url: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const onlineRate = data.cameras_total > 0 ? Math.round((data.cameras_online / data.cameras_total) * 100) : 0;
  const clientRate = data.clients_total > 0 ? Math.round((data.clients_active / data.clients_total) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase text-primary">
            <ShieldCheck className="h-4 w-4" /> Acesso proprietário
          </div>
          <h1 className="text-2xl font-bold text-foreground">Gestão do SaaS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Empresas, planos e recursos liberados na plataforma.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-success">
          <span className="status-dot status-online" /> Plataforma operacional
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Não foi possível carregar os indicadores da plataforma.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Indicadores da plataforma">
            <StatsCard title="Clientes" value={isLoading ? '—' : data.clients_total} icon={Users} trend={`${data.clients_active} ativos`} />
            <StatsCard title="Usuários" value={isLoading ? '—' : data.users_total} icon={ShieldCheck} />
            <StatsCard title="Câmeras" value={isLoading ? '—' : data.cameras_total} icon={Camera} trend={`${data.cameras_online} online`} variant={onlineRate < 80 ? 'warning' : 'success'} />
            <StatsCard title="Alarmes abertos" value={isLoading ? '—' : data.alarms_open} icon={Bell} variant={data.alarms_open > 0 ? 'warning' : 'default'} />
            <StatsCard title="Mensalidades" value={isLoading ? '—' : data.monthly_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={DollarSign} variant="success" />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="border-y border-border py-5 lg:col-span-2">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase text-foreground">
                <Activity className="h-4 w-4 text-primary" /> Operação global
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Clientes ativos</span><span className="font-mono text-foreground">{clientRate}%</span></div>
                  <Progress value={clientRate} className="h-2" />
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Câmeras online</span><span className="font-mono text-foreground">{onlineRate}%</span></div>
                  <Progress value={onlineRate} className="h-2 [&>div]:bg-success" />
                </div>
              </div>
            </div>

            <div className="border-y border-border py-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase text-foreground">
                <Database className="h-4 w-4 text-primary" /> Infraestrutura
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Video className="h-4 w-4" /> Gravações</span><strong className="font-mono">{data.recordings_total}</strong></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Database className="h-4 w-4" /> Servidores locais</span><strong className="font-mono">{data.storage_servers_total}</strong></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Cloud className="h-4 w-4" /> Armazenamentos cloud</span><strong className="font-mono">{data.cloud_storages_total}</strong></div>
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Empresas do SaaS</h2>
                <p className="text-sm text-muted-foreground">{companies.length} cadastradas · {activeCompanies} ativas</p>
              </div>
              <Button onClick={openNewCompany}><Plus /> Adicionar empresa</Button>
            </div>

            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Contato</TableHead><TableHead>Plano</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {companiesLoading ? (
                    <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Carregando empresas...</TableCell></TableRow>
                  ) : companies.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nenhuma empresa cadastrada.</TableCell></TableRow>
                  ) : companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell><strong>{company.name}</strong><div className="text-xs text-muted-foreground">{company.document || 'Documento não informado'}</div><div className="mt-1 flex items-center gap-1 font-mono text-xs text-primary"><ExternalLink className="h-3 w-3" />{getCompanyAccessUrl(company)}</div></TableCell>
                      <TableCell><div>{company.email || '—'}</div><div className="text-xs text-muted-foreground">{company.phone || '—'}</div></TableCell>
                      <TableCell>{company.plan_name}</TableCell>
                      <TableCell><Badge variant={company.status === 'active' ? 'default' : 'secondary'}>{company.status === 'active' ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                      <TableCell><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => openFeatures(company)}><Settings2 /> Recursos</Button><Button variant="ghost" size="icon" title="Editar empresa" onClick={() => openEditCompany(company)}><Pencil /></Button></div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}

      <Dialog open={companyDialog} onOpenChange={setCompanyDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCompanySubmit} className="space-y-4">
            <DialogHeader><DialogTitle>{editingCompany ? 'Editar empresa' : 'Adicionar empresa'}</DialogTitle><DialogDescription>Cadastre a empresa assinante da plataforma.</DialogDescription></DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
               <div className="sm:col-span-2"><Label htmlFor="company-name">Nome fantasia</Label><Input id="company-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, subdomain: editingCompany ? form.subdomain : normalizeSubdomain(event.target.value) })} required /></div>
               <div className="sm:col-span-2"><Label htmlFor="company-browser-title">Nome na aba do navegador</Label><Input id="company-browser-title" value={form.browser_title} onChange={(event) => setForm({ ...form, browser_title: event.target.value })} placeholder={`${form.name || 'Empresa'} | Monitoramento`} maxLength={60} /></div>
               <div className="sm:col-span-2"><Label>Tipo de endereço</Label><Select value={form.domain_type} onValueChange={(value: 'subdomain' | 'custom') => setForm({ ...form, domain_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="subdomain">Subdomínio automático</SelectItem><SelectItem value="custom">Domínio próprio do cliente</SelectItem></SelectContent></Select></div>
               {form.domain_type === 'subdomain' ? <div className="sm:col-span-2"><Label htmlFor="company-subdomain">Subdomínio</Label><Input id="company-subdomain" value={form.subdomain} onChange={(event) => setForm({ ...form, subdomain: normalizeSubdomain(event.target.value) })} placeholder="nome-da-empresa" required /><p className="mt-1 text-xs font-mono text-primary">{form.subdomain ? getCompanyUrl(form.subdomain) : 'O endereço será gerado pelo nome da empresa.'}</p></div> : <div className="sm:col-span-2"><Label htmlFor="company-custom-domain">Domínio do cliente</Label><Input id="company-custom-domain" value={form.custom_domain} onChange={(event) => setForm({ ...form, custom_domain: event.target.value.toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/g, '') })} placeholder="monitoramento.cliente.com.br" inputMode="url" autoCapitalize="none" spellCheck={false} required /><p className="mt-1 text-xs font-mono text-primary">{form.custom_domain ? `https://${normalizeDomain(form.custom_domain)}` : 'Informe o domínio completo do cliente.'}</p></div>}
              <div className="sm:col-span-2"><Label htmlFor="company-legal-name">Razão social</Label><Input id="company-legal-name" value={form.legal_name} onChange={(event) => setForm({ ...form, legal_name: event.target.value })} /></div>
              <div><Label htmlFor="company-document">CNPJ/CPF</Label><Input id="company-document" value={form.document} onChange={(event) => setForm({ ...form, document: event.target.value })} /></div>
              <div><Label htmlFor="company-phone">Telefone</Label><Input id="company-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
              <div className="sm:col-span-2"><Label htmlFor="company-email">E-mail</Label><Input id="company-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
              <div className="sm:col-span-2"><Label htmlFor="company-address">Endereço</Label><Input id="company-address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
              <div className="sm:col-span-2"><Label htmlFor="company-logo">Logotipo da empresa</Label><Input id="company-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} /><p className="mt-1 text-xs text-muted-foreground">PNG, JPG ou WebP. Máximo 2 MB.</p></div>
              <div><Label>Tempo de gravação</Label><Select value={String(form.recording_segment_minutes)} onValueChange={(value) => setForm({ ...form, recording_segment_minutes: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[5, 10, 15, 30, 60, 120].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes < 60 ? `${minutes} minutos` : `${minutes / 60} hora${minutes > 60 ? 's' : ''}`}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Plano</Label><Input value={form.plan_name} onChange={(event) => setForm({ ...form, plan_name: event.target.value })} /></div>
              <div><Label>Situação</Label><Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativa</SelectItem><SelectItem value="inactive">Inativa</SelectItem></SelectContent></Select></div>
              <div className="sm:col-span-2 border-t border-border pt-4"><h3 className="font-semibold text-foreground">Usuário de acesso</h3><p className="text-xs text-muted-foreground">Dados usados para entrar no sistema desta empresa.</p></div>
              <div><Label htmlFor="access-name">Nome do usuário</Label><Input id="access-name" value={accessForm.name} onChange={(event) => setAccessForm({ ...accessForm, name: event.target.value })} disabled={accessLoading} required /></div>
              <div><Label htmlFor="access-email">E-mail de acesso</Label><Input id="access-email" type="email" value={accessForm.email} onChange={(event) => setAccessForm({ ...accessForm, email: event.target.value })} disabled={accessLoading} required /></div>
               {!editingCompany && <div className="sm:col-span-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">A senha temporária será gerada automaticamente. No primeiro acesso, o usuário deverá criar uma nova senha.</div>}
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setCompanyDialog(false)}>Cancelar</Button><Button type="submit" disabled={saveCompany.isPending || accessLoading}>{saveCompany.isPending ? 'Salvando...' : 'Salvar empresa'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(temporaryAccess)} onOpenChange={(open) => { if (!open) { setTemporaryAccess(null); setPasswordCopied(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Empresa criada</DialogTitle><DialogDescription>Envie estes dados ao administrador. A senha deverá ser alterada no primeiro acesso.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>E-mail</Label><Input readOnly value={temporaryAccess?.email || ''} /></div>
            <div><Label>Senha temporária</Label><div className="flex gap-2"><Input readOnly value={temporaryAccess?.password || ''} className="font-mono" /><Button type="button" size="icon" variant="outline" title="Copiar senha" onClick={async () => { if (!temporaryAccess) return; await navigator.clipboard.writeText(temporaryAccess.password); setPasswordCopied(true); }}>{passwordCopied ? <Check /> : <Copy />}</Button></div></div>
          </div>
          <DialogFooter><Button onClick={() => { setTemporaryAccess(null); setPasswordCopied(false); }}>Concluir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={featuresDialog} onOpenChange={setFeaturesDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Liberar recursos</DialogTitle><DialogDescription>Escolha o que {selectedCompany?.name} poderá usar.</DialogDescription></DialogHeader>
          <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
            {modules.map(([module, label]) => <div key={module} className="flex items-center justify-between border-b border-border py-3"><Label htmlFor={`module-${module}`}>{label}</Label><Switch id={`module-${module}`} checked={enabledModules.includes(module)} onCheckedChange={(checked) => setEnabledModules((current) => checked ? [...current, module] : current.filter((item) => item !== module))} /></div>)}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFeaturesDialog(false)}>Cancelar</Button><Button onClick={() => saveFeatures.mutate()} disabled={saveFeatures.isPending}>{saveFeatures.isPending ? 'Salvando...' : 'Salvar liberações'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerDashboard;