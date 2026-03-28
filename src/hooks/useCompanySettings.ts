import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';
import { useAuth } from '@/contexts/AuthContext';

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

export const companySettingsQueryKey = ['company_settings'] as const;

const getLocalSession = () => {
  try {
    const stored = sessionStorage.getItem('nexus-local-session') || localStorage.getItem('nexus-local-session');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const fetchLocalCompanySettings = async () => {
  const session = getLocalSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/vnd.pgrst.object+json',
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
};

const fetchPublicCompanyBranding = async () => {
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
};

const fetchPrivateCompanySettings = async () => {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as CompanySettings;
};

export function useCompanySettings() {
  const { user, loading } = useAuth();
  const isLocal = isLocalInstallation();

  return useQuery({
    queryKey: [...companySettingsQueryKey, isLocal ? 'local' : user ? 'private' : 'public'],
    queryFn: async () => {
      if (isLocal) {
        return fetchLocalCompanySettings();
      }

      return user ? fetchPrivateCompanySettings() : fetchPublicCompanyBranding();
    },
    enabled: isLocal || !loading,
    staleTime: 0,
    gcTime: 1000 * 30,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
