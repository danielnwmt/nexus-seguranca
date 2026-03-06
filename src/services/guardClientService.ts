import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';

function getLocalHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  try {
    const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
    if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  } catch {}
  return headers;
}

/** Fetch all client IDs linked to a guard via guard_clients table */
export async function fetchGuardClientIds(guardId: string): Promise<string[]> {
  if (isLocalInstallation()) {
    const res = await fetch(
      `${getLocalApiBase()}/rest/v1/guard_clients?guard_id=eq.${guardId}&select=client_id`,
      { headers: getLocalHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((r: any) => r.client_id);
  }
  const { data, error } = await (supabase.from('guard_clients') as any)
    .select('client_id')
    .eq('guard_id', guardId);
  if (error) return [];
  return (data || []).map((r: any) => r.client_id);
}

/** Sync guard-client assignments: delete removed, insert new */
export async function syncGuardClients(guardId: string, clientIds: string[]) {
  if (isLocalInstallation()) {
    // Delete all current
    await fetch(`${getLocalApiBase()}/rest/v1/guard_clients?guard_id=eq.${guardId}`, {
      method: 'DELETE',
      headers: getLocalHeaders(),
    });
    // Insert new
    if (clientIds.length > 0) {
      await fetch(`${getLocalApiBase()}/rest/v1/guard_clients`, {
        method: 'POST',
        headers: getLocalHeaders({ 'Prefer': 'return=representation' }),
        body: JSON.stringify(clientIds.map(cid => ({ guard_id: guardId, client_id: cid }))),
      });
    }
  } else {
    // Delete all current
    await (supabase.from('guard_clients') as any).delete().eq('guard_id', guardId);
    // Insert new
    if (clientIds.length > 0) {
      await (supabase.from('guard_clients') as any).insert(
        clientIds.map(cid => ({ guard_id: guardId, client_id: cid }))
      );
    }
  }
}
