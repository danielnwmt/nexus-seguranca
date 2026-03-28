import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';

export interface CompanySettings {
  id: string;
  name: string;
  cnpj: string | null;
  razao_social: string | null;
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
        const session = JSON.parse(sessionStorage.getItem('nexus-local-session') || '{}');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.pgrst.object+json',
        };

        if (session.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const res = await fetch(
          `${getLocalApiBase()}/rest/v1/company_settings?select=*&limit=1`,
          { headers, cache: 'no-store' }
        );
        if (!res.ok) throw new Error('Erro ao buscar configurações');
        return (await res.json()) as CompanySettings;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const { data, error } = await supabase
          .from('company_branding_public')
          .select('id, name, logo_url, login_bg_url')
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        return {
          id: data?.id || '',
          name: data?.name || 'Nexus Monitoramento',
          cnpj: null,
          razao_social: null,
          address: null,
          phone: null,
          email: null,
          logo_url: data?.logo_url || null,
          media_server_ip: null,
          login_bg_url: data?.login_bg_url || null,
        } as CompanySettings;
      }

      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CompanySettings;
    },
    staleTime: 0,
    gcTime: 1000 * 30,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
