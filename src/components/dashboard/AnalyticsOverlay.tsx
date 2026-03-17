import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';
import { AlertTriangle, Eye, ShieldAlert, Users, Car } from 'lucide-react';

interface AnalyticsEvent {
  id: string;
  event_type: string;
  camera_id: string | null;
  camera_name: string | null;
  confidence: number | null;
  created_at: string;
  details: any;
}

interface AnalyticsOverlayProps {
  cameraId?: string;
  /** Show events for all cameras if no cameraId */
  compact?: boolean;
}

const eventIcons: Record<string, typeof Eye> = {
  motion: Eye,
  person: Users,
  vehicle: Car,
  intrusion: ShieldAlert,
  tampering: AlertTriangle,
  line_crossing: AlertTriangle,
  loitering: Eye,
};

const eventColors: Record<string, string> = {
  motion: 'bg-primary/80',
  person: 'bg-blue-500/80',
  vehicle: 'bg-amber-500/80',
  intrusion: 'bg-destructive/80',
  tampering: 'bg-destructive/80',
  line_crossing: 'bg-warning/80',
  loitering: 'bg-orange-500/80',
};

const AnalyticsOverlay = ({ cameraId, compact = false }: AnalyticsOverlayProps) => {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const isLocal = isLocalInstallation();

  // Fetch recent events
  useEffect(() => {
    const fetchEvents = async () => {
      if (isLocal) {
        try {
          const session = JSON.parse(sessionStorage.getItem('nexus-local-session') || '{}');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
          let url = `${getLocalApiBase()}/rest/v1/analytics_events?select=*&order=created_at.desc&limit=5`;
          if (cameraId) url += `&camera_id=eq.${cameraId}`;
          const res = await fetch(url, { headers });
          if (res.ok) setEvents(await res.json());
        } catch {}
        return;
      }
      let query = supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (cameraId) query = query.eq('camera_id', cameraId);
      const { data } = await query;
      if (data) setEvents(data);
    };

    fetchEvents();
  }, [cameraId, isLocal]);

  // Subscribe to realtime events (cloud only)
  useEffect(() => {
    if (isLocal) return;

    const channel = supabase
      .channel(`analytics-overlay-${cameraId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'analytics_events',
          ...(cameraId ? { filter: `camera_id=eq.${cameraId}` } : {}),
        },
        (payload) => {
          const newEvent = payload.new as AnalyticsEvent;
          setEvents(prev => [newEvent, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [cameraId, isLocal]);

  if (events.length === 0) return null;

  return (
    <div className={`absolute ${compact ? 'bottom-1 right-1' : 'top-10 right-2'} z-30 flex flex-col gap-1 max-w-[200px]`}>
      {events.slice(0, compact ? 2 : 5).map((evt) => {
        const Icon = eventIcons[evt.event_type] || Eye;
        const bgColor = eventColors[evt.event_type] || 'bg-muted/80';
        const time = new Date(evt.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const confidence = evt.confidence ? `${Math.round(evt.confidence * 100)}%` : '';

        return (
          <div
            key={evt.id}
            className={`${bgColor} backdrop-blur-sm rounded px-2 py-1 flex items-center gap-1.5 text-white animate-in slide-in-from-right-5 duration-300`}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-mono leading-tight truncate">
                {evt.event_type.replace(/_/g, ' ').toUpperCase()}
                {confidence && <span className="ml-1 opacity-70">{confidence}</span>}
              </p>
              {!compact && (
                <p className="text-[8px] opacity-70 font-mono">{time}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AnalyticsOverlay;
