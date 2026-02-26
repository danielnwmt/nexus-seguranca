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
