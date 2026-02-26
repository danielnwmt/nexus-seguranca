
-- Installers table
CREATE TABLE public.installers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text,
  phone text,
  email text,
  specialty text DEFAULT 'cameras',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.installers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_crud_installers" ON public.installers FOR ALL TO authenticated
  USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());

CREATE TRIGGER handle_installers_updated_at
  BEFORE UPDATE ON public.installers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Service Orders table
CREATE TABLE public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL DEFAULT ('OS-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 4)),
  client_id uuid REFERENCES public.clients(id),
  client_name text,
  installer_id uuid REFERENCES public.installers(id),
  installer_name text,
  type text NOT NULL DEFAULT 'installation',
  description text,
  status text NOT NULL DEFAULT 'pending',
  scheduled_date date,
  completed_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_crud_service_orders" ON public.service_orders FOR ALL TO authenticated
  USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());

CREATE TRIGGER handle_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
