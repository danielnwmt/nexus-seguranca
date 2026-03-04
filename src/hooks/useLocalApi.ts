import { useState, useEffect, useCallback } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';

/**
 * Detecta se estamos rodando em uma instalação local (não no preview da Lovable)
 */
export function isLocalInstallation(): boolean {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  // Instalação local real sempre define PROJECT_ID como "local"
  if (projectId === 'local') return true;

  // Em domínios publicados/customizados, nunca forçar modo local por hostname
  return false;
}

export function getLocalApiBase() {
  const origin = window.location.origin.replace(/\/$/, '');
  return `${origin}/auth`;
}

/**
 * Retorna a URL base para acessar a API de gerenciamento de um servidor (local ou remoto).
 * - Se o IP do servidor for o mesmo do hostname atual → usa proxy Nginx (/auth/api/...)
 * - Se estiver em HTTP → acessa diretamente http://IP:8001/api/...
 * - Se estiver em HTTPS e IP diferente → usa proxy local que repassa ao servidor remoto
 *   Fallback: tenta via proxy local primeiro, depois direto se HTTP
 */
export function getServerApiUrl(serverIp: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const currentHost = window.location.hostname;
  
  // Se o servidor é o próprio host, usa proxy Nginx (funciona em HTTP e HTTPS)
  if (serverIp === currentHost || serverIp === '127.0.0.1' || serverIp === 'localhost') {
    return `${window.location.origin}/auth/api${normalizedPath}`;
  }
  
  // Para servidores remotos em HTTPS: proxy via servidor local
  if (window.location.protocol === 'https:') {
    return `${window.location.origin}/auth/api${normalizedPath}`;
  }
  
  // HTTP: acesso direto ao servidor remoto
  return `http://${serverIp}:8001/api${normalizedPath}`;
}

/**
 * Converte nome de tabela para endpoint legado (media-servers, storage-servers)
 * Para outras tabelas, usa o proxy PostgREST via /rest/v1/
 */
const LEGACY_ENDPOINTS: Record<string, string> = {
  media_servers: 'media-servers',
  storage_servers: 'storage-servers',
};

function isLegacyTable(table: string): boolean {
  return table in LEGACY_ENDPOINTS;
}

/**
 * Hook genérico para buscar dados de qualquer tabela local
 * Usa endpoints legados para media_servers/storage_servers
 * Usa proxy PostgREST (/rest/v1/) para todas as outras tabelas
 */
function getLocalAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  try {
    const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
    if (session.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch {}
  return headers;
}

export function useLocalTableQuery<T = any>(table: string, orderBy = 'created_at', ascending = false) {
  return useQuery<T[]>({
    queryKey: ['local', table],
    queryFn: async () => {
      if (isLegacyTable(table)) {
        const res = await fetch(`${getLocalApiBase()}/api/local/${LEGACY_ENDPOINTS[table]}`, { headers: getLocalAuthHeaders() });
        if (!res.ok) throw new Error(`Erro ao buscar ${table}`);
        return res.json();
      }
      const res = await fetch(
        `${getLocalApiBase()}/rest/v1/${table}?select=*&order=${orderBy}.${ascending ? 'asc' : 'desc'}`,
        { headers: getLocalAuthHeaders() }
      );
      if (!res.ok) throw new Error(`Erro ao buscar ${table}`);
      return res.json();
    },
    enabled: isLocalInstallation(),
  });
}

/**
 * Hook paginado para tabelas locais via proxy PostgREST
 */
export function useLocalPaginatedQuery<T = any>(
  table: string,
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
    queryKey: ['local', table, 'paginated', page, pageSize, search, filters],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const params = new URLSearchParams();
      params.set('select', '*');
      params.set('order', `${orderBy}.${ascending ? 'asc' : 'desc'}`);
      params.set('offset', String(from));
      params.set('limit', String(pageSize));

      // Text search
      if (search && searchColumns && searchColumns.length > 0) {
        const orFilter = searchColumns.map(col => `${col}.ilike.*${search}*`).join(',');
        params.set('or', `(${orFilter})`);
      }

      // Exact filters
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value && value !== 'all') {
            params.set(key, `eq.${value}`);
          }
        }
      }

      const res = await fetch(
        `${getLocalApiBase()}/rest/v1/${table}?${params.toString()}`,
        { headers: getLocalAuthHeaders({ 'Prefer': 'count=exact' }) }
      );
      if (!res.ok) throw new Error(`Erro ao buscar ${table}`);

      const data = await res.json() as T[];
      // PostgREST retorna contagem no header Content-Range
      const contentRange = res.headers.get('content-range');
      let count = data.length;
      if (contentRange) {
        const match = contentRange.match(/\/(\d+|\*)/);
        if (match && match[1] !== '*') count = parseInt(match[1]);
      }

      return {
        data,
        count,
        totalPages: Math.ceil(count / pageSize),
      };
    },
    placeholderData: (prev: any) => prev,
    enabled: isLocalInstallation(),
  });
}

export function useLocalInsertMutation(table: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      if (isLegacyTable(table)) {
        const res = await fetch(`${getLocalApiBase()}/api/local/${LEGACY_ENDPOINTS[table]}`, {
          method: 'POST',
          headers: getLocalAuthHeaders(),
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao inserir');
        }
        return res.json();
      }
      const res = await fetch(`${getLocalApiBase()}/rest/v1/${table}`, {
        method: 'POST',
        headers: getLocalAuthHeaders({ 'Prefer': 'return=representation' }),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro ao inserir' }));
        throw new Error(err.message || err.error || 'Erro ao inserir');
      }
      const result = await res.json();
      return Array.isArray(result) ? result[0] : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local', table] });
    },
  });
}

export function useLocalUpdateMutation(table: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const { id, ...rest } = data;
      if (isLegacyTable(table)) {
        const res = await fetch(`${getLocalApiBase()}/api/local/${LEGACY_ENDPOINTS[table]}/${id}`, {
          method: 'PUT',
          headers: getLocalAuthHeaders(),
          body: JSON.stringify(rest),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao atualizar');
        }
        return res.json();
      }
      const res = await fetch(`${getLocalApiBase()}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: getLocalAuthHeaders({ 'Prefer': 'return=representation' }),
        body: JSON.stringify(rest),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro ao atualizar' }));
        throw new Error(err.message || err.error || 'Erro ao atualizar');
      }
      const result = await res.json();
      return Array.isArray(result) ? result[0] : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local', table] });
    },
  });
}

export function useLocalPatchMutation(table: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const { id, ...rest } = data;
      if (isLegacyTable(table)) {
        const endpoint = LEGACY_ENDPOINTS[table];
        const res = await fetch(`${getLocalApiBase()}/api/local/${endpoint}/${id}`, {
          method: 'PATCH',
          headers: getLocalAuthHeaders(),
          body: JSON.stringify(rest),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao atualizar');
        }
        return res.json();
      }
      const res = await fetch(`${getLocalApiBase()}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: getLocalAuthHeaders({ 'Prefer': 'return=representation' }),
        body: JSON.stringify(rest),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro ao atualizar' }));
        throw new Error(err.message || err.error || 'Erro ao atualizar');
      }
      const result = await res.json();
      return Array.isArray(result) ? result[0] : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local', table] });
    },
  });
}

export function useLocalDeleteMutation(table: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (isLegacyTable(table)) {
        const res = await fetch(`${getLocalApiBase()}/api/local/${LEGACY_ENDPOINTS[table]}/${id}`, {
          method: 'DELETE',
          headers: getLocalAuthHeaders(),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao remover');
        }
        return res.json();
      }
      const res = await fetch(`${getLocalApiBase()}/rest/v1/${table}?id=eq.${id}`, {
        method: 'DELETE',
        headers: getLocalAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro ao remover' }));
        throw new Error(err.message || err.error || 'Erro ao remover');
      }
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local', table] });
    },
  });
}
