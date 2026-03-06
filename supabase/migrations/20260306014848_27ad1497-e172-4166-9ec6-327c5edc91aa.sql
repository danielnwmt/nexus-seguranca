
-- 1. Soft deletes: Add deleted_at column to clients, cameras, guards
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2. Create guard_clients junction table (N:N)
CREATE TABLE IF NOT EXISTS public.guard_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guard_id, client_id)
);

-- 3. Enable RLS on guard_clients
ALTER TABLE public.guard_clients ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for guard_clients
CREATE POLICY "Admins full access to guard_clients" ON public.guard_clients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can read guard_clients" ON public.guard_clients FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- 5. Enable realtime for alarms
ALTER PUBLICATION supabase_realtime ADD TABLE public.alarms;

-- 6. Create indexes for soft deletes
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON public.clients(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cameras_deleted_at ON public.cameras(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guards_deleted_at ON public.guards(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guard_clients_guard ON public.guard_clients(guard_id);
CREATE INDEX IF NOT EXISTS idx_guard_clients_client ON public.guard_clients(client_id);

-- 7. Migrate existing client_ids arrays from guards into guard_clients
INSERT INTO public.guard_clients (guard_id, client_id)
SELECT g.id, unnest(g.client_ids)::uuid
FROM public.guards g
WHERE g.client_ids IS NOT NULL AND array_length(g.client_ids, 1) > 0
ON CONFLICT (guard_id, client_id) DO NOTHING;
