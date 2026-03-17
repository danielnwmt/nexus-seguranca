import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTableQuery } from '@/hooks/useSupabaseQuery';
import { isLocalInstallation } from '@/hooks/useLocalApi';

export type CameraStatus = 'online' | 'offline' | 'recording';

export interface CameraData {
  id: string;
  name: string;
  client_id: string | null;
  stream_url: string | null;
  stream_key: string;
  protocol: string;
  status: CameraStatus;
  location: string | null;
  resolution: string | null;
  retention_days: number;
  storage_path: string | null;
  analytics: string[] | null;
  latitude: number | null;
  longitude: number | null;
  snapshot_url: string | null;
  brand: string | null;
  auto_record: boolean | null;
}

interface UseCamerasOptions {
  statusFilter?: CameraStatus | 'all';
  clientId?: string;
}

/**
 * Hook de câmeras com assinatura Realtime para INSERT/UPDATE/DELETE.
 * No modo local, apenas faz polling via react-query.
 * No cloud, assina mudanças via Supabase Realtime e invalida o cache automaticamente.
 */
export function useCameras(options?: UseCamerasOptions) {
  const { statusFilter = 'all', clientId } = options || {};
  const queryClient = useQueryClient();
  const isLocal = isLocalInstallation();

  const { data: rawCameras = [], isLoading, error, refetch } = useTableQuery<CameraData>('cameras');
  const { data: clients = [] } = useTableQuery('clients');

  // Realtime subscription (cloud only)
  useEffect(() => {
    if (isLocal) return;

    const channel = supabase
      .channel('cameras-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cameras' },
        () => {
          // Invalidate react-query cache to refetch
          queryClient.invalidateQueries({ queryKey: ['cameras'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLocal, queryClient]);

  // Filtered cameras
  const cameras = useMemo(() => {
    let list = rawCameras as CameraData[];
    if (statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter);
    }
    if (clientId && clientId !== 'all') {
      list = list.filter(c => c.client_id === clientId);
    }
    return list;
  }, [rawCameras, statusFilter, clientId]);

  const onlineCount = useMemo(() => (rawCameras as CameraData[]).filter(c => c.status !== 'offline').length, [rawCameras]);
  const offlineCount = useMemo(() => (rawCameras as CameraData[]).filter(c => c.status === 'offline').length, [rawCameras]);

  const getClientName = useCallback((clientIdParam: string | null) => {
    if (!clientIdParam) return '';
    const client = (clients as any[]).find(c => c.id === clientIdParam);
    return client?.name || '';
  }, [clients]);

  return {
    cameras,
    allCameras: rawCameras as CameraData[],
    clients: clients as any[],
    isLoading,
    error,
    refetch,
    onlineCount,
    offlineCount,
    totalCount: (rawCameras as CameraData[]).length,
    getClientName,
  };
}
