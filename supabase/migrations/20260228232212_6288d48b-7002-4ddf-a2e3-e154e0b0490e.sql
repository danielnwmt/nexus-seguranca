
CREATE TABLE public.recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  camera_id UUID REFERENCES public.cameras(id) ON DELETE CASCADE,
  camera_name TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  file_path TEXT NOT NULL DEFAULT '',
  file_size_mb NUMERIC NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can CRUD recordings"
  ON public.recordings FOR ALL
  USING (is_authenticated())
  WITH CHECK (is_authenticated());

CREATE INDEX idx_recordings_camera ON public.recordings(camera_id);
CREATE INDEX idx_recordings_start ON public.recordings(start_time DESC);
CREATE INDEX idx_recordings_client ON public.recordings(client_id);
