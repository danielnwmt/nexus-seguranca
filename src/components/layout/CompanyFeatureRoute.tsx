import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const CompanyFeatureRoute = ({ module, children }: { module: string; children: React.ReactNode }) => {
  const { companyId, companyFeatures, companyAccessLoading, userRole } = useAuth();

  if (companyAccessLoading) {
    return <div className="py-16 text-center text-sm font-mono text-muted-foreground">Verificando recursos...</div>;
  }

  if (userRole === 'owner') {
    return <Navigate to="/owner" replace />;
  }

  if (companyId && !companyFeatures.includes(module)) {
    if (module !== 'dashboard' && companyFeatures.includes('dashboard')) {
      return <Navigate to="/" replace />;
    }
    return <div className="py-16 text-center text-sm font-mono text-muted-foreground">Recurso não liberado para sua empresa.</div>;
  }

  return <>{children}</>;
};

export default CompanyFeatureRoute;