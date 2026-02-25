import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Camera, Users, Bell, DollarSign, Shield, Settings } from 'lucide-react';
import bravoLogo from '@/assets/bravo-logo.webp';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/cameras', icon: Camera, label: 'Câmeras' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/guards', icon: Shield, label: 'Vigilantes' },
  { to: '/financial', icon: DollarSign, label: 'Financeiro' },
  { to: '/alarms', icon: Bell, label: 'Alarmes' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
  
];

const AppSidebar = () => {
  const location = useLocation();

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col fixed left-0 top-0 z-30">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={bravoLogo} alt="Bravo Monitoramento" className="w-9 h-9 object-contain" />
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-wide">BRAVO</h1>
            <p className="text-[10px] font-mono text-muted-foreground tracking-widest">MONITORAMENTO</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
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

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="status-dot status-online" />
          <span className="text-xs font-mono text-muted-foreground">Sistema Online</span>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
