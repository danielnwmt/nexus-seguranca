import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const OwnerRoute = ({ children }: { children: React.ReactNode }) => {
  const { userRole, roleLoading } = useAuth();

  if (roleLoading) {
    return <div className="py-16 text-center text-sm font-mono text-muted-foreground">Verificando acesso...</div>;
  }

  if (userRole !== 'owner') return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default OwnerRoute;