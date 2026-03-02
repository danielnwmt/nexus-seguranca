import { useState, useEffect, useCallback } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';

/**
 * Detecta se estamos rodando em uma instalação local (não no preview da Lovable)
 */
export function isLocalInstallation(): boolean {
  const hostname = window.location.hostname;
  return !hostname.includes('lovable.app') && !hostname.includes('localhost');
}

function getLocalApiBase() {
  return `http://${window.location.hostname}:8001`;
}

/**
 * Hook para buscar dados de uma tabela local via auth-server
 */
export function useLocalTableQuery<T = any>(table: string) {
  const endpoint = table === 'media_servers' ? 'media-servers' : 'storage-servers';

  return useQuery<T[]>({
    queryKey: ['local', table],
    queryFn: async () => {
      const res = await fetch(`${getLocalApiBase()}/api/local/${endpoint}`);
      if (!res.ok) throw new Error(`Erro ao buscar ${table}`);
      return res.json();
    },
    enabled: isLocalInstallation(),
  });
}

export function useLocalInsertMutation(table: string) {
  const queryClient = useQueryClient();
  const endpoint = table === 'media_servers' ? 'media-servers' : 'storage-servers';

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${getLocalApiBase()}/api/local/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao inserir');
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['local', table] }),
  });
}

export function useLocalUpdateMutation(table: string) {
  const queryClient = useQueryClient();
  const endpoint = table === 'media_servers' ? 'media-servers' : 'storage-servers';

  return useMutation({
    mutationFn: async (data: any) => {
      const { id, ...rest } = data;
      const res = await fetch(`${getLocalApiBase()}/api/local/${endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar');
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['local', table] }),
  });
}

export function useLocalPatchMutation(table: string) {
  const queryClient = useQueryClient();
  const endpoint = table === 'media_servers' ? 'media-servers' : 'storage-servers';

  return useMutation({
    mutationFn: async (data: any) => {
      const { id, ...rest } = data;
      const res = await fetch(`${getLocalApiBase()}/api/local/${endpoint}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar');
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['local', table] }),
  });
}

export function useLocalDeleteMutation(table: string) {
  const queryClient = useQueryClient();
  const endpoint = table === 'media_servers' ? 'media-servers' : 'storage-servers';

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${getLocalApiBase()}/api/local/${endpoint}/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao remover');
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['local', table] }),
  });
}
