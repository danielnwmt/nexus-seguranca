import { useQuery } from '@tanstack/react-query';
import { Activity, Bell, Camera, Cloud, Database, DollarSign, ShieldCheck, Users, Video } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

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

const OwnerDashboard = () => {
  const { data = emptyStats, isLoading, error } = useQuery({
    queryKey: ['owner-dashboard-stats'],
    queryFn: async () => {
      const { data: result, error: queryError } = await supabase.rpc('get_owner_dashboard_stats');
      if (queryError) throw queryError;
      return { ...emptyStats, ...(result as unknown as Partial<OwnerStats>) };
    },
    refetchInterval: 60_000,
  });

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
          <p className="mt-1 text-sm text-muted-foreground">Visão consolidada da operação Nexus Segurança.</p>
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
        </>
      )}
    </div>
  );
};

export default OwnerDashboard;