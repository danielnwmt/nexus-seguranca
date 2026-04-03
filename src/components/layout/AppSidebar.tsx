import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Camera, Users, Bell, DollarSign, Shield, Settings, LogOut, Headphones, ClipboardList, Wrench, Brain, Film, Activity, MapPin, Clock, Monitor, Package, FileText, HandCoins } from 'lucide-react';
import nexusLogo from '@/assets/nexus-logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useRolePermissions, buildPermissionMap } from '@/hooks/useRolePermissions';

// Map route to permission module key
const navItems: { to: string; icon: any; label: string; permModule?: string }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', permModule: 'dashboard' },
  { to: '/cameras', icon: Camera, label: 'Câmeras', permModule: 'cameras_view' },
  { to: '/live', icon: Monitor, label: 'Ao Vivo', permModule: 'cameras_view' },
  { to: '/camera-map', icon: MapPin, label: 'Mapa', permModule: 'cameras_view' },
  { to: '/recordings', icon: Film, label: 'Gravações', permModule: 'cameras_view' },
  { to: '/timeline', icon: Clock, label: 'Timeline', permModule: 'cameras_view' },
  { to: '/clients', icon: Users, label: 'Clientes', permModule: 'clients_view' },
  { to: '/guards', icon: Shield, label: 'Vigilantes', permModule: 'guards' },
  { to: '/installers', icon: Wrench, label: 'Técnicos', permModule: 'installers' },
  { to: '/service-orders', icon: ClipboardList, label: 'Ordens de Serviço', permModule: 'service_orders' },
  { to: '/stock', icon: Package, label: 'Estoque', permModule: 'financial' },
  { to: '/quotes', icon: FileText, label: 'Orçamentos', permModule: 'financial' },
  { to: '/sales', icon: HandCoins, label: 'Vendedores', permModule: 'financial' },
  { to: '/financial', icon: DollarSign, label: 'Financeiro', permModule: 'financial' },
  { to: '/alarms', icon: Bell, label: 'Alarmes', permModule: 'alarms' },
  { to: '/analytics', icon: Brain, label: 'Analíticos IA', permModule: 'cameras_view' },
  { to: '/system-health', icon: Activity, label: 'Saúde do Sistema', permModule: 'settings' },
  { to: '/support', icon: Headphones, label: 'Atendimento', permModule: 'support' },
  { to: '/settings', icon: Settings, label: 'Configurações', permModule: 'settings' },
];

const defaultPermissions: Record<string, Record<string, boolean>> = {
  n1: {
    dashboard: true, cameras_view: true, cameras_edit: false, clients_view: false, clients_edit: false,
    guards: false, installers: false, service_orders: false, financial: false, alarms: true, support: false, settings: false, users: false,
  },
  n2: {
    dashboard: true, cameras_view: true, cameras_edit: true, clients_view: true, clients_edit: false,
    guards: true, installers: false, service_orders: false, financial: false, alarms: true, support: true, settings: false, users: false,
  },
  n3: {
    dashboard: true, cameras_view: true, cameras_edit: true, clients_view: true, clients_edit: true,
    guards: true, installers: true, service_orders: true, financial: true, alarms: true, support: true, settings: false, users: false,
  },
  admin: {
    dashboard: true, cameras_view: true, cameras_edit: true, clients_view: true, clients_edit: true,
    guards: true, installers: true, service_orders: true, financial: true, alarms: true, support: true, settings: true, users: true,
  },
};

const AppSidebar = () => {
  const location = useLocation();
  const { signOut, user, userRole, isSeller, isClient } = useAuth();
  const { data: company } = useCompanySettings();
  const { data: rolePermissionsData } = useRolePermissions();

  const permissionMap = buildPermissionMap(rolePermissionsData, defaultPermissions);
  const role = userRole || 'n1';
  const myPerms = permissionMap[role] || defaultPermissions[role] || {};

  // Admin sees everything
  const isAdmin = role === 'admin';

  // Client routes
  const clientRoutes = ['/live', '/recordings', '/alarms'];

  const visibleItems = navItems.filter(item => {
    // Clients see only their cameras, recordings, alarms
    if (isClient) return clientRoutes.includes(item.to);
    // Sellers only see Clients
    if (isSeller) return item.to === '/clients';
    if (isAdmin) return true;
    if (!item.permModule) return true;
    return myPerms[item.permModule] === true;
  });

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col fixed left-0 top-0 z-30">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={company?.logo_url || nexusLogo} alt={company?.name || 'Nexus Segurança'} className="w-9 h-9 object-contain rounded" />
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-wide">{company?.name?.toUpperCase() || 'NEXUS'}</h1>
            <p className="text-[10px] font-mono text-muted-foreground tracking-widest">MONITORAMENTO</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary glow-border'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="flex items-center gap-2">
          <div className="status-dot status-online" />
          <span className="text-xs font-mono text-muted-foreground">Sistema Online</span>
        </div>
        {user && (
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors w-full"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
