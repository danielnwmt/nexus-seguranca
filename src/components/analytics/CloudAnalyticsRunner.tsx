import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation } from '@/hooks/useLocalApi';

export const CLOUD_ANALYTICS_KEY = 'nexus-cloud-analytics-enabled';
export const CLOUD_ANALYTICS_EVENT = 'nexus-cloud-analytics-change';

const isEnabled = () => localStorage.getItem(CLOUD_ANALYTICS_KEY) === 'true';

const CloudAnalyticsRunner = () => {
  const running = useRef(false);

  useEffect(() => {
    if (isLocalInstallation()) return;

    let intervalId: number | undefined;

    const runCycle = async () => {
      if (running.current || !isEnabled()) return;
      running.current = true;
      try {
        await supabase.functions.invoke('auto-analyze-cameras', { body: {} });
      } finally {
        running.current = false;
      }
    };

    const sync = () => {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = undefined;
      if (isEnabled()) {
        void runCycle();
        intervalId = window.setInterval(runCycle, 30_000);
      }
    };

    window.addEventListener('storage', sync);
    window.addEventListener(CLOUD_ANALYTICS_EVENT, sync);
    sync();

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('storage', sync);
      window.removeEventListener(CLOUD_ANALYTICS_EVENT, sync);
    };
  }, []);

  return null;
};

export default CloudAnalyticsRunner;