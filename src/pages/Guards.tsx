import { useState, useEffect } from 'react';
import { Shield, Plus, Search, Pencil, Trash2, Moon, Sun, Clock, MapPin, Route } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTableQuery, useInsertMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PatrolRouteMap from '@/components/guards/PatrolRouteMap';

const maskCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

const shiftConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  day: { label: 'Diurno', icon: Sun, className: 'bg-warning/10 text-warning' },
  night: { label: 'Noturno', icon: Moon, className: 'bg-primary/10 text-primary' },
  '12x36': { label: '12x36', icon: Clock, className: 'bg-accent/10 text-accent' },
};

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-success/10 text-success' },
  inactive: { label: 'Inativo', className: 'bg-destructive/10 text-destructive' },
  on_leave: { label: 'Afastado', className: 'bg-warning/10 text-warning' },
};

// Geocode city name to lat/lng using Nominatim
const geocodeCity = async (city: string): Promise<[number, number] | null> => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&countrycodes=br`);
    const data = await res.json();
    if (data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch (e) {
    console.warn('Geocode failed', e);
  }
  return null;
};

const Guards = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: guards = [], isLoading } = useTableQuery('guards');
  const { data: clients = [] } = useTableQuery('clients');
  const insertMutation = useInsertMutation('guards');
  const updateMutation = useUpdateMutation('guards');
  const deleteMutation = useDeleteMutation('guards');

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', cpf: '', phone: '', email: '', shift: 'day', status: 'active', cnv: '', clientIds: [] as string[] });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Patrol route state
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [selectedGuardForRoute, setSelectedGuardForRoute] = useState<any>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<{ lat: number; lng: number }[]>([]);
  const [routeName, setRouteName] = useState('Ronda');
  const [selectedRouteClient, setSelectedRouteClient] = useState<string>('');
  const [routeCity, setRouteCity] = useState('');
  const [routeMapCenter, setRouteMapCenter] = useState<[number, number] | undefined>(undefined);
  const [viewRouteGuard, setViewRouteGuard] = useState<any>(null);
  const [viewMapCenter, setViewMapCenter] = useState<[number, number] | undefined>(undefined);

  // Fetch patrol routes
  const { data: patrolRoutes = [] } = useQuery({
    queryKey: ['patrol_routes'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('patrol_routes') as any).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Geocode when city changes in route creation
  useEffect(() => {
    if (!routeCity || routeCity.length < 3) return;
    const timer = setTimeout(async () => {
      const coords = await geocodeCity(routeCity);
      if (coords) setRouteMapCenter(coords);
    }, 800);
    return () => clearTimeout(timer);
  }, [routeCity]);

  // When selecting a route to view, center on its city or first waypoint
  const handleSelectRoute = async (route: any) => {
    const guard = guards.find((g: any) => g.id === route.guard_id);
    setViewRouteGuard({ ...guard, routeId: route.id, waypoints: route.waypoints });
    if (route.city) {
      const coords = await geocodeCity(route.city);
      if (coords) {
        setViewMapCenter(coords);
        return;
      }
    }
    if (route.waypoints?.length > 0) {
      setViewMapCenter([route.waypoints[0].lat, route.waypoints[0].lng]);
    }
  };

  const filtered = guards.filter((g: any) =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.cpf || '').includes(search)
  );

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!form.cpf.trim()) newErrors.cpf = 'CPF é obrigatório';
    if (!form.phone.trim()) newErrors.phone = 'Telefone é obrigatório';
    if (!form.email.trim()) newErrors.email = 'Email é obrigatório';
    if (!form.cnv.trim()) newErrors.cnv = 'CNV é obrigatória';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast({ title: 'Campos obrigatórios', description: Object.values(newErrors).join(', '), variant: 'destructive' });
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const payload = {
      name: form.name, cpf: form.cpf, phone: form.phone, email: form.email,
      shift: form.shift, status: form.status, cnv: form.cnv || null, client_ids: form.clientIds,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload } as any);
    } else {
      insertMutation.mutate(payload as any);
    }
    resetForm();
  };

  const handleEdit = (guard: any) => {
    setEditingId(guard.id);
    setForm({
      name: guard.name, cpf: guard.cpf || '', phone: guard.phone || '', email: guard.email || '',
      shift: guard.shift, status: guard.status, cnv: guard.cnv || '',
      clientIds: guard.client_ids || [],
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  const toggleClient = (clientId: string) => {
    setForm(prev => ({
      ...prev,
      clientIds: prev.clientIds.includes(clientId)
        ? prev.clientIds.filter(id => id !== clientId)
        : [...prev.clientIds, clientId],
    }));
  };

  const resetForm = () => {
    setForm({ name: '', cpf: '', phone: '', email: '', shift: 'day', status: 'active', cnv: '', clientIds: [] });
    setErrors({});
    setEditingId(null);
    setDialogOpen(false);
  };

  const openRouteDialog = (guard: any) => {
    setSelectedGuardForRoute(guard);
    setRouteWaypoints([]);
    setRouteName('Ronda');
    setSelectedRouteClient('');
    setRouteCity('');
    setRouteMapCenter(undefined);
    setRouteDialogOpen(true);
  };

  const handleSaveRoute = async () => {
    if (routeWaypoints.length < 2) {
      toast({ title: 'Adicione pelo menos 2 pontos na rota', variant: 'destructive' });
      return;
    }
    if (!routeCity.trim()) {
      toast({ title: 'Informe a cidade da ronda', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await (supabase.from('patrol_routes') as any).insert({
        guard_id: selectedGuardForRoute.id,
        client_id: selectedRouteClient || null,
        name: routeName,
        waypoints: routeWaypoints,
        city: routeCity,
      });
      if (error) throw error;
      toast({ title: 'Rota de ronda salva com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['patrol_routes'] });
      setRouteDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao salvar rota', variant: 'destructive' });
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    try {
      const { error } = await (supabase.from('patrol_routes') as any).delete().eq('id', routeId);
      if (error) throw error;
      toast({ title: 'Rota removida' });
      queryClient.invalidateQueries({ queryKey: ['patrol_routes'] });
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    }
  };

  const getGuardRoutes = (guardId: string) => patrolRoutes.filter((r: any) => r.guard_id === guardId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vigilantes</h1>
          <p className="text-sm text-muted-foreground font-mono">Gestão de vigilantes, escalas e rondas</p>
        </div>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="gap-2"><Shield className="w-3.5 h-3.5" /> Vigilantes</TabsTrigger>
          <TabsTrigger value="ronda" className="gap-2"><Route className="w-3.5 h-3.5" /> Rondas</TabsTrigger>
        </TabsList>

        {/* TAB: Lista de vigilantes */}
        <TabsContent value="list" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar vigilante..." className="pl-9 bg-muted border-border" />
            </div>
            <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); else setDialogOpen(true); }}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => { setEditingId(null); resetForm(); }}>
                  <Plus className="w-4 h-4" /> Novo Vigilante
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-foreground">{editingId ? 'Editar Vigilante' : 'Novo Vigilante'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome *</Label>
                      <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" className={`bg-muted border-border ${errors.name ? 'border-destructive' : ''}`} />
                      {errors.name && <p className="text-[10px] text-destructive mt-1">{errors.name}</p>}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CPF *</Label>
                      <Input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: maskCpf(e.target.value) }))} placeholder="000.000.000-00" className={`bg-muted border-border font-mono ${errors.cpf ? 'border-destructive' : ''}`} />
                      {errors.cpf && <p className="text-[10px] text-destructive mt-1">{errors.cpf}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Telefone *</Label>
                      <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: maskPhone(e.target.value) }))} placeholder="(11) 91234-5678" className={`bg-muted border-border font-mono ${errors.phone ? 'border-destructive' : ''}`} />
                      {errors.phone && <p className="text-[10px] text-destructive mt-1">{errors.phone}</p>}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email *</Label>
                      <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" className={`bg-muted border-border ${errors.email ? 'border-destructive' : ''}`} />
                      {errors.email && <p className="text-[10px] text-destructive mt-1">{errors.email}</p>}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CNV (Carteira Nacional de Vigilante) *</Label>
                    <Input value={form.cnv} onChange={e => setForm(p => ({ ...p, cnv: e.target.value }))} placeholder="Número da CNV" className={`bg-muted border-border font-mono ${errors.cnv ? 'border-destructive' : ''}`} />
                    {errors.cnv && <p className="text-[10px] text-destructive mt-1">{errors.cnv}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Turno</Label>
                      <Select value={form.shift} onValueChange={v => setForm(p => ({ ...p, shift: v }))}>
                        <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Diurno</SelectItem>
                          <SelectItem value="night">Noturno</SelectItem>
                          <SelectItem value="12x36">12x36</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                        <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                          <SelectItem value="on_leave">Afastado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Clientes Vinculados</Label>
                    <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                      {clients.map((client: any) => (
                        <div key={client.id} className="flex items-center gap-2">
                          <Checkbox checked={form.clientIds.includes(client.id)} onCheckedChange={() => toggleClient(client.id)} id={`client-${client.id}`} />
                          <label htmlFor={`client-${client.id}`} className="text-xs text-foreground cursor-pointer">{client.name}</label>
                        </div>
                      ))}
                      {clients.length === 0 && <p className="text-xs text-muted-foreground">Nenhum cliente cadastrado</p>}
                    </div>
                  </div>
                  <Button onClick={handleSave} className="w-full">{editingId ? 'Salvar Alterações' : 'Adicionar Vigilante'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Vigilante</th>
                  <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">CPF</th>
                  <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">CNV</th>
                  <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Contato</th>
                  <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Turno</th>
                  <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Clientes</th>
                  <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Rondas</th>
                  <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((guard: any) => {
                  const shift = shiftConfig[guard.shift] || shiftConfig.day;
                  const ShiftIcon = shift.icon;
                  const st = statusLabels[guard.status] || statusLabels.active;
                  const linkedClients = clients.filter((c: any) => (guard.client_ids || []).includes(c.id));
                  const routes = getGuardRoutes(guard.id);
                  return (
                    <tr key={guard.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{guard.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">Desde {guard.hire_date ? new Date(guard.hire_date).toLocaleDateString('pt-BR') : '-'}</p>
                      </td>
                      <td className="px-4 py-3"><p className="text-xs font-mono text-foreground">{guard.cpf}</p></td>
                      <td className="px-4 py-3"><p className="text-xs font-mono text-foreground">{guard.cnv || '-'}</p></td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-foreground">{guard.phone}</p>
                        <p className="text-[10px] text-muted-foreground">{guard.email}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full ${shift.className}`}>
                          <ShiftIcon className="w-3 h-3" />
                          {shift.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {linkedClients.map((c: any) => (
                            <span key={c.id} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{c.name.split(' ')[0]}</span>
                          ))}
                          {linkedClients.length === 0 && <span className="text-[10px] text-muted-foreground">Nenhum</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-mono text-foreground">{routes.length}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full ${st.className}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openRouteDialog(guard)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-primary/10 transition-colors text-muted-foreground hover:text-primary" title="Adicionar Ronda">
                            <Route className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleEdit(guard)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(guard.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
              <Shield className="w-12 h-12 mb-3" />
              <p className="text-sm">Nenhum vigilante encontrado</p>
            </div>
          )}
        </TabsContent>

        {/* TAB: Rondas */}
        <TabsContent value="ronda" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Route list */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Route className="w-4 h-4 text-primary" />
                Rotas Cadastradas
              </h3>
              {patrolRoutes.length === 0 && (
                <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma rota cadastrada. Vá na lista de vigilantes e clique no ícone de rota.</p>
              )}
              {patrolRoutes.map((route: any) => {
                const guard = guards.find((g: any) => g.id === route.guard_id);
                const client = clients.find((c: any) => c.id === route.client_id);
                const isSelected = viewRouteGuard?.routeId === route.id;
                return (
                  <div
                    key={route.id}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}
                    onClick={() => handleSelectRoute(route)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{route.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{guard?.name || 'Vigilante removido'}</p>
                        {client && <p className="text-[10px] text-muted-foreground">Cliente: {client.name}</p>}
                        {route.city && (
                          <p className="text-[10px] text-primary font-mono flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" /> {route.city}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-muted-foreground">{(route.waypoints || []).length} pts</span>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRoute(route.id); }} className="w-6 h-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Map */}
            <div className="lg:col-span-2 h-[500px] rounded-lg border border-border overflow-hidden">
              {viewRouteGuard ? (
                <PatrolRouteMap
                  waypoints={viewRouteGuard.waypoints || []}
                  guardName={viewRouteGuard.name}
                  className="h-full"
                  center={viewMapCenter}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                  <MapPin className="w-12 h-12 mb-3" />
                  <p className="text-sm">Selecione uma rota para visualizar no mapa</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Route creation dialog */}
      <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova Rota de Ronda — {selectedGuardForRoute?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Nome da Rota</Label>
                <Input value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Ex: Ronda Noturna" className="bg-muted border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cidade *</Label>
                <Input value={routeCity} onChange={e => setRouteCity(e.target.value)} placeholder="Ex: Brasília, DF" className="bg-muted border-border" />
                <p className="text-[10px] text-muted-foreground mt-0.5">O mapa abrirá nesta cidade</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cliente (opcional)</Label>
                <Select value={selectedRouteClient} onValueChange={setSelectedRouteClient}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="h-[400px]">
              <PatrolRouteMap
                waypoints={routeWaypoints}
                onWaypointsChange={setRouteWaypoints}
                editable
                className="h-full"
                center={routeMapCenter}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-mono">{routeWaypoints.length} pontos definidos</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRouteWaypoints([])}>Limpar</Button>
                <Button onClick={handleSaveRoute} className="gap-2"><MapPin className="w-4 h-4" /> Salvar Rota</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Guards;
