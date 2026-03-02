import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';

export interface CompanySettings {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  media_server_ip: string | null;
  login_bg_url: string | null;
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => {
      if (isLocalInstallation()) {
        const res = await fetch(
          `${getLocalApiBase()}/rest/v1/company_settings?select=*&limit=1`,
          { headers: { 'Content-Type': 'application/json', 'Accept': 'application/vnd.pgrst.object+json' } }
        );
        if (!res.ok) throw new Error('Erro ao buscar configurações');
        return (await res.json()) as CompanySettings;
      }
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CompanySettings;
    },
    staleTime: 1000 * 60 * 5,
  });
}
