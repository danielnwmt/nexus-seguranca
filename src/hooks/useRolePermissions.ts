import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';

export interface RolePermission {
  id: string;
  role: string;
  module: string;
  allowed: boolean;
}

function getLocalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const session = JSON.parse(sessionStorage.getItem('nexus-local-session') || localStorage.getItem('nexus-local-session') || '{}');
    if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  } catch {}
  return headers;
}

export function useRolePermissions() {
  const isLocal = isLocalInstallation();

  return useQuery<RolePermission[]>({
    queryKey: ['role_permissions'],
    queryFn: async () => {
      if (isLocal) {
        const res = await fetch(`${getLocalApiBase()}/rest/v1/role_permissions?select=*&order=role.asc,module.asc`, {
          headers: getLocalHeaders(),
        });
        if (!res.ok) return [];
        return res.json();
      }
      const { data, error } = await (supabase.from('role_permissions' as any) as any)
        .select('*')
        .order('role')
        .order('module');
      if (error) return [];
      return data as RolePermission[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateRolePermission() {
  const qc = useQueryClient();
  const isLocal = isLocalInstallation();

  return useMutation({
    mutationFn: async ({ role, module, allowed }: { role: string; module: string; allowed: boolean }) => {
      if (isLocal) {
        // Try upsert via PostgREST
        const res = await fetch(`${getLocalApiBase()}/rest/v1/role_permissions?role=eq.${role}&module=eq.${module}`, {
          method: 'PATCH',
          headers: { ...getLocalHeaders(), 'Prefer': 'return=representation' },
          body: JSON.stringify({ allowed }),
        });
        if (!res.ok) throw new Error('Erro ao atualizar permissão');
        return res.json();
      }
      const { error } = await (supabase.from('role_permissions' as any) as any)
        .update({ allowed })
        .eq('role', role)
        .eq('module', module);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role_permissions'] });
    },
  });
}

/**
 * Converts the flat array of role_permissions into a nested map:
 * { n1: { dashboard: true, cameras_view: true, ... }, ... }
 */
export function buildPermissionMap(
  permissions: RolePermission[] | undefined,
  fallback: Record<string, Record<string, boolean>>
): Record<string, Record<string, boolean>> {
  if (!permissions || permissions.length === 0) return fallback;
  const map: Record<string, Record<string, boolean>> = {};
  for (const p of permissions) {
    if (!map[p.role]) map[p.role] = {};
    map[p.role][p.module] = p.allowed;
  }
  // Merge with fallback for any missing entries
  for (const role of Object.keys(fallback)) {
    if (!map[role]) map[role] = { ...fallback[role] };
    else {
      for (const mod of Object.keys(fallback[role])) {
        if (map[role][mod] === undefined) map[role][mod] = fallback[role][mod];
      }
    }
  }
  return map;
}
