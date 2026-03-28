
-- Table to store customizable permission matrix per role
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  module text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, module)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated can read (needed for sidebar filtering)
CREATE POLICY "All authenticated can read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (is_authenticated());

-- Only admins can modify
CREATE POLICY "Admins can manage role_permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Seed default permissions
INSERT INTO public.role_permissions (role, module, allowed) VALUES
  ('n1', 'dashboard', true), ('n1', 'cameras_view', true), ('n1', 'cameras_edit', false),
  ('n1', 'clients_view', false), ('n1', 'clients_edit', false), ('n1', 'guards', false),
  ('n1', 'installers', false), ('n1', 'service_orders', false), ('n1', 'financial', false),
  ('n1', 'alarms', true), ('n1', 'support', false), ('n1', 'settings', false), ('n1', 'users', false),
  ('n2', 'dashboard', true), ('n2', 'cameras_view', true), ('n2', 'cameras_edit', true),
  ('n2', 'clients_view', true), ('n2', 'clients_edit', false), ('n2', 'guards', true),
  ('n2', 'installers', false), ('n2', 'service_orders', false), ('n2', 'financial', false),
  ('n2', 'alarms', true), ('n2', 'support', true), ('n2', 'settings', false), ('n2', 'users', false),
  ('n3', 'dashboard', true), ('n3', 'cameras_view', true), ('n3', 'cameras_edit', true),
  ('n3', 'clients_view', true), ('n3', 'clients_edit', true), ('n3', 'guards', true),
  ('n3', 'installers', true), ('n3', 'service_orders', true), ('n3', 'financial', true),
  ('n3', 'alarms', true), ('n3', 'support', true), ('n3', 'settings', false), ('n3', 'users', false),
  ('admin', 'dashboard', true), ('admin', 'cameras_view', true), ('admin', 'cameras_edit', true),
  ('admin', 'clients_view', true), ('admin', 'clients_edit', true), ('admin', 'guards', true),
  ('admin', 'installers', true), ('admin', 'service_orders', true), ('admin', 'financial', true),
  ('admin', 'alarms', true), ('admin', 'support', true), ('admin', 'settings', true), ('admin', 'users', true)
ON CONFLICT (role, module) DO NOTHING;
