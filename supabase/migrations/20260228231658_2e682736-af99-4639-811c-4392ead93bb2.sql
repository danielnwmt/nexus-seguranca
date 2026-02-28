
CREATE TABLE public.analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  camera_id UUID REFERENCES public.cameras(id) ON DELETE CASCADE,
  camera_name TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name TEXT,
  event_type TEXT NOT NULL DEFAULT 'motion',
  confidence NUMERIC DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can CRUD analytics_events"
  ON public.analytics_events FOR ALL
  USING (is_authenticated())
  WITH CHECK (is_authenticated());

CREATE INDEX idx_analytics_events_camera ON public.analytics_events(camera_id);
CREATE INDEX idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.analytics_events;
