/**
 * Helpers para obter token de autenticação local ou cloud
 */
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';

/**
 * Retorna o access_token independente do ambiente (local ou cloud)
 */
export async function getAccessToken(): Promise<string> {
  if (isLocalInstallation()) {
    const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
    return session.access_token || '';
  }
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}

/**
 * Retorna o user metadata independente do ambiente
 */
export function getLocalUser(): any {
  if (isLocalInstallation()) {
    const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
    return session.user || null;
  }
  return null;
}

/**
 * Atualiza a senha do usuário (local ou cloud)
 */
export async function updateUserPassword(password: string): Promise<{ error: string | null }> {
  if (isLocalInstallation()) {
    const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
    const res = await fetch(`${getLocalApiBase()}/api/local/update-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token || ''}`,
      },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Erro ao atualizar senha' };
    // Update local session metadata
    if (session.user?.user_metadata) {
      session.user.user_metadata.force_password_change = false;
      localStorage.setItem('nexus-local-session', JSON.stringify(session));
    }
    return { error: null };
  }
  const { error } = await supabase.auth.updateUser({
    password,
    data: { force_password_change: false },
  });
  return { error: error?.message || null };
}

/**
 * Fetch data from a table (local or cloud)
 */
export async function fetchTableData(table: string): Promise<any[]> {
  if (isLocalInstallation()) {
    const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const res = await fetch(
      `${getLocalApiBase()}/rest/v1/${table}?select=*`,
      { headers }
    );
    if (!res.ok) return [];
    return res.json();
  }
  const { data, error } = await supabase.from(table as any).select('*');
  if (error) return [];
  return data || [];
}

/**
 * Upsert data into a table (local or cloud)
 */
export async function upsertTableData(table: string, row: Record<string, unknown>): Promise<{ error: boolean }> {
  if (isLocalInstallation()) {
    const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    };
    if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const res = await fetch(`${getLocalApiBase()}/rest/v1/${table}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(row),
    });
    return { error: !res.ok };
  }
  const { error } = await supabase.from(table as any).upsert(row as any, { onConflict: 'id' });
  return { error: !!error };
}

/**
 * Count rows in a table (local or cloud)
 */
export async function countTableRows(table: string): Promise<number> {
  if (isLocalInstallation()) {
    const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Prefer': 'count=exact' };
    if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const res = await fetch(
      `${getLocalApiBase()}/rest/v1/${table}?select=id&limit=1`,
      { headers }
    );
    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)/);
      if (match) return parseInt(match[1]);
    }
    return 0;
  }
  const { count } = await supabase.from(table as any).select('id', { count: 'exact', head: true });
  return count || 0;
}
