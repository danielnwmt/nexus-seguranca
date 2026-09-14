import { useEffect } from 'react';
import { useCompanySettings } from '@/hooks/useCompanySettings';

const BrowserTitle = () => {
  const { data: company } = useCompanySettings();

  useEffect(() => {
    document.title = company?.browser_title?.trim() || `${company?.name || 'Nexus Segurança'} | Monitoramento`;
  }, [company?.browser_title, company?.name]);

  return null;
};

export default BrowserTitle;