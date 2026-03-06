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

export async function acknowledgeAllAlarms(alarmIds: string[]) {
  if (isLocalInstallation()) {
    for (const id of alarmIds) {
      await fetch(`${getLocalApiBase()}/rest/v1/alarms?id=eq.${id}`, {
        method: 'PATCH',
        headers: getLocalHeaders({ 'Prefer': 'return=representation' }),
        body: JSON.stringify({ acknowledged: true }),
      });
    }
  } else {
    for (const id of alarmIds) {
      await supabase.from('alarms').update({ acknowledged: true }).eq('id', id);
    }
  }
}

export function subscribeToAlarms(callback: (payload: any) => void) {
  const channel = supabase
    .channel('alarms-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'alarms' }, callback)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
