CREATE TABLE public.alarm_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  name text NOT NULL,
  manufacturer text,
  model text,
  account_number text,
  partitions integer NOT NULL DEFAULT 1,
  zones_count integer NOT NULL DEFAULT 8,
  ip_address text,
  port integer,
  phone text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alarm_panels TO authenticated;
GRANT ALL ON public.alarm_panels TO service_role;
ALTER TABLE public.alarm_panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view alarm panels" ON public.alarm_panels FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'n2') OR public.has_role(auth.uid(),'n3') OR public.has_role(auth.uid(),'n1'));
CREATE POLICY "Staff can manage alarm panels" ON public.alarm_panels FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'n2') OR public.has_role(auth.uid(),'n3'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'n2') OR public.has_role(auth.uid(),'n3'));

CREATE TRIGGER set_updated_at_alarm_panels BEFORE UPDATE ON public.alarm_panels
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.alarm_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid NOT NULL REFERENCES public.alarm_panels(id) ON DELETE CASCADE,
  zone_number integer NOT NULL,
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'perimeter',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (panel_id, zone_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alarm_zones TO authenticated;
GRANT ALL ON public.alarm_zones TO service_role;
ALTER TABLE public.alarm_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view alarm zones" ON public.alarm_zones FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'n2') OR public.has_role(auth.uid(),'n3') OR public.has_role(auth.uid(),'n1'));
CREATE POLICY "Staff can manage alarm zones" ON public.alarm_zones FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'n2') OR public.has_role(auth.uid(),'n3'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'n2') OR public.has_role(auth.uid(),'n3'));

CREATE TRIGGER set_updated_at_alarm_zones BEFORE UPDATE ON public.alarm_zones
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.alarms
  ADD COLUMN IF NOT EXISTS panel_id uuid REFERENCES public.alarm_panels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zone_number integer,
  ADD COLUMN IF NOT EXISTS handling_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS handled_by uuid,
  ADD COLUMN IF NOT EXISTS handled_at timestamptz,
  ADD COLUMN IF NOT EXISTS action_taken text,
  ADD COLUMN IF NOT EXISTS handling_notes text;

NOTIFY pgrst, 'reload schema';