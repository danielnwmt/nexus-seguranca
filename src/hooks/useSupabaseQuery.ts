import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type TableName = 'clients' | 'cameras' | 'guards' | 'alarms' | 'invoices' | 'storage_servers' | 'installers' | 'service_orders';

export function useTableQuery<T = any>(table: TableName, orderBy = 'created_at', ascending = false) {
  return useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await (supabase.from(table) as any)
        .select('*')
        .order(orderBy, { ascending });
      if (error) throw error;
      return data as T[];
    },
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

  return useQuery({
    queryKey: [table, 'paginated', page, pageSize, search, filters],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = (supabase.from(table) as any)
        .select('*', { count: 'exact' })
        .order(orderBy, { ascending })
        .range(from, to);

      // Text search using ilike on multiple columns
      if (search && searchColumns && searchColumns.length > 0) {
        const orFilter = searchColumns.map(col => `${col}.ilike.%${search}%`).join(',');
        query = query.or(orFilter);
      }

      // Exact filters
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
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { data, error } = await (supabase.from(table) as any).insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}

export function useUpdateMutation(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, unknown> & { id: string }) => {
      const { data, error } = await (supabase.from(table) as any).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}

export function useDeleteMutation(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from(table) as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}
