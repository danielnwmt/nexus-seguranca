import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompanySettings {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  media_server_ip: string | null;
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as CompanySettings;
    },
    staleTime: 1000 * 60 * 5,
  });
}
