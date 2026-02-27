
CREATE TABLE public.patrol_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID REFERENCES public.guards(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Ronda',
  waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.patrol_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can CRUD patrol_routes"
  ON public.patrol_routes
  FOR ALL
  TO authenticated
  USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());
