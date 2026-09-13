import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const CompanyFeatureRoute = ({ module, children }: { module: string; children: React.ReactNode }) => {
  const { companyId, companyFeatures, companyAccessLoading, userRole } = useAuth();

  if (companyAccessLoading) {
    return <div className="py-16 text-center text-sm font-mono text-muted-foreground">Verificando recursos...</div>;
  }

  if (userRole !== 'owner' && companyId && !companyFeatures.includes(module)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default CompanyFeatureRoute;