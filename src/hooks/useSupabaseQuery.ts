import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';

type TableName = 'clients' | 'cameras' | 'guards' | 'alarms' | 'invoices' | 'storage_servers' | 'installers' | 'service_orders' | 'bills' | 'media_servers' | 'recordings' | 'analytics_events' | 'guard_clients';

// Tables that support soft delete (deleted_at column)
const SOFT_DELETE_TABLES: Set<string> = new Set(['clients', 'cameras', 'guards']);

function getLocalHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  try {
    const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
    if (session.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch {}
  return headers;
}

function getLocalRestCandidates(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const direct = `${getLocalApiBase()}/rest/v1${normalizedPath}`;
  const sameOrigin = `/rest/v1${normalizedPath}`;
  return direct === sameOrigin ? [direct] : [direct, sameOrigin];
}

async function fetchLocalRest(path: string, init?: RequestInit): Promise<Response> {
  const candidates = getLocalRestCandidates(path);
  let lastError: unknown = null;

  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i];
    try {
      const res = await fetch(url, init);
      if (res.ok || i === candidates.length - 1) return res;
      if (![404, 405, 500, 502, 503, 504].includes(res.status)) return res;
    } catch (err) {
      lastError = err;
      if (i === candidates.length - 1) throw err;
    }
  }

  if (lastError) throw lastError;
  throw new Error('Falha de rede no backend local');
}

/**
 * Hook genérico para buscar dados de uma tabela.
 * Em instalações locais, usa o proxy PostgREST via auth-server (porta 8001).
 * No cloud (Lovable/Supabase), usa o cliente Supabase direto.
 */
export function useTableQuery<T = any>(table: TableName, orderBy = 'created_at', ascendingOrOptions?: boolean | { ascending?: boolean; enabled?: boolean }) {
  const ascending = typeof ascendingOrOptions === 'boolean' ? ascendingOrOptions : (ascendingOrOptions?.ascending ?? false);
  const enabled = typeof ascendingOrOptions === 'object' ? (ascendingOrOptions?.enabled ?? true) : true;
  const isLocal = isLocalInstallation();

  return useQuery({
    queryKey: isLocal ? ['local', table] : [table],
    queryFn: async () => {
      if (isLocal) {
        const softFilter = SOFT_DELETE_TABLES.has(table) ? '&deleted_at=is.null' : '';
        const res = await fetchLocalRest(
          `/${table}?select=*&order=${orderBy}.${ascending ? 'asc' : 'desc'}${softFilter}`,
          { headers: getLocalHeaders() }
        );
        if (!res.ok) throw new Error(`Erro ao buscar ${table}`);
        return res.json() as Promise<T[]>;
      }
      let query = (supabase.from(table) as any)
        .select('*')
        .order(orderBy, { ascending });
      if (SOFT_DELETE_TABLES.has(table)) {
        query = query.is('deleted_at', null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as T[];
    },
    enabled,
  });
}

export function usePaginatedQuery<T = any>(
  table: TableName,
  page: number,
  pageSize: number,
  options?: {
    orderBy?: string;
    ascending?: boolean;
    search?: string;
    searchColumns?: string[];
    filters?: Record<string, string>;
  }
) {
  const { orderBy = 'created_at', ascending = false, search, searchColumns, filters } = options || {};
  const isLocal = isLocalInstallation();

  return useQuery({
    queryKey: isLocal
      ? ['local', table, 'paginated', page, pageSize, search, filters]
      : [table, 'paginated', page, pageSize, search, filters],
    queryFn: async () => {
      if (isLocal) {
        const from = page * pageSize;
        const params = new URLSearchParams();
        params.set('select', '*');
        params.set('order', `${orderBy}.${ascending ? 'asc' : 'desc'}`);
        params.set('offset', String(from));
        params.set('limit', String(pageSize));

        if (SOFT_DELETE_TABLES.has(table)) {
          params.set('deleted_at', 'is.null');
        }

        if (search && searchColumns && searchColumns.length > 0) {
          const orFilter = searchColumns.map(col => `${col}.ilike.*${search}*`).join(',');
          params.set('or', `(${orFilter})`);
        }
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            if (value && value !== 'all') {
              params.set(key, `eq.${value}`);
            }
          }
        }

        const res = await fetchLocalRest(
          `/${table}?${params.toString()}`,
          { headers: getLocalHeaders({ 'Prefer': 'count=exact' }) }
        );
        if (!res.ok) throw new Error(`Erro ao buscar ${table}`);
        const data = await res.json() as T[];
        const contentRange = res.headers.get('content-range');
        let count = data.length;
        if (contentRange) {
          const match = contentRange.match(/\/(\d+|\*)/);
          if (match && match[1] !== '*') count = parseInt(match[1]);
        }
        return { data, count, totalPages: Math.ceil(count / pageSize) };
      }

      // Cloud Supabase
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = (supabase.from(table) as any)
        .select('*', { count: 'exact' })
        .order(orderBy, { ascending })
        .range(from, to);

      if (SOFT_DELETE_TABLES.has(table)) {
        query = query.is('deleted_at', null);
      }

      if (search && searchColumns && searchColumns.length > 0) {
        const orFilter = searchColumns.map(col => `${col}.ilike.%${search}%`).join(',');
        query = query.or(orFilter);
      }
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value && value !== 'all') {
            query = query.eq(key, value);
          }
        }
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data || []) as T[], count: count || 0, totalPages: Math.ceil((count || 0) / pageSize) };
    },
    placeholderData: (prev) => prev,
  });
}

export function useInsertMutation(table: TableName) {
  const qc = useQueryClient();
  const isLocal = isLocalInstallation();

  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      if (isLocal) {
        const res = await fetchLocalRest(`/${table}`, {
          method: 'POST',
          headers: getLocalHeaders({ 'Prefer': 'return=representation' }),
          body: JSON.stringify(row),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Erro ao inserir' }));
          throw new Error(err.message || err.error || 'Erro ao inserir');
        }
        const result = await res.json();
        return Array.isArray(result) ? result[0] : result;
      }
      const { data, error } = await (supabase.from(table) as any).insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: isLocal ? ['local', table] : [table] });
    },
  });
}

export function useUpdateMutation(table: TableName) {
  const qc = useQueryClient();
  const isLocal = isLocalInstallation();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, unknown> & { id: string }) => {
      if (isLocal) {
        const res = await fetchLocalRest(`/${table}?id=eq.${id}`, {
          method: 'PATCH',
          headers: getLocalHeaders({ 'Prefer': 'return=representation' }),
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Erro ao atualizar' }));
          throw new Error(err.message || err.error || 'Erro ao atualizar');
        }
        const result = await res.json();
        return Array.isArray(result) ? result[0] : result;
      }
      const { data, error } = await (supabase.from(table) as any).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: isLocal ? ['local', table] : [table] });
    },
  });
}

export function useDeleteMutation(table: TableName) {
  const qc = useQueryClient();
  const isLocal = isLocalInstallation();

  return useMutation({
    mutationFn: async (id: string) => {
      const useSoftDelete = SOFT_DELETE_TABLES.has(table);

      if (isLocal) {
        if (useSoftDelete) {
          const res = await fetchLocalRest(`/${table}?id=eq.${id}`, {
            method: 'PATCH',
            headers: getLocalHeaders({ 'Prefer': 'return=representation' }),
            body: JSON.stringify({ deleted_at: new Date().toISOString() }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Erro ao remover' }));
            throw new Error(err.message || err.error || 'Erro ao remover');
          }
        } else {
          const res = await fetchLocalRest(`/${table}?id=eq.${id}`, {
            method: 'DELETE',
            headers: getLocalHeaders(),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Erro ao remover' }));
            throw new Error(err.message || err.error || 'Erro ao remover');
          }
        }
        return { success: true };
      }

      if (useSoftDelete) {
        const { error } = await (supabase.from(table) as any)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from(table) as any).delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: isLocal ? ['local', table] : [table] });
    },
  });
}
