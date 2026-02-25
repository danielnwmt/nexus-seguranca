
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'n1', 'n2');

-- User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'n1',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is authenticated (for RLS)
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- RLS policy for user_roles
CREATE POLICY "Authenticated users can read roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text,
  email text,
  phone text,
  address text,
  cameras_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  monthly_fee numeric,
  payment_due_day integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can CRUD clients" ON public.clients
  FOR ALL TO authenticated USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());

-- Cameras table
CREATE TABLE public.cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  stream_url text,
  protocol text NOT NULL DEFAULT 'RTSP',
  status text NOT NULL DEFAULT 'online',
  location text,
  resolution text DEFAULT '1920x1080',
  storage_path text,
  retention_days integer NOT NULL DEFAULT 30,
  analytics text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can CRUD cameras" ON public.cameras
  FOR ALL TO authenticated USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());

-- Guards table
CREATE TABLE public.guards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text,
  phone text,
  email text,
  shift text NOT NULL DEFAULT 'day',
  status text NOT NULL DEFAULT 'active',
  client_ids text[] DEFAULT '{}',
  hire_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can CRUD guards" ON public.guards
  FOR ALL TO authenticated USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());

-- Alarms table
CREATE TABLE public.alarms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id uuid REFERENCES public.cameras(id) ON DELETE SET NULL,
  camera_name text,
  client_name text,
  type text NOT NULL DEFAULT 'motion',
  severity text NOT NULL DEFAULT 'warning',
  message text,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can CRUD alarms" ON public.alarms
  FOR ALL TO authenticated USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());

-- Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name text,
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  bank text,
  paid_at date,
  boleto_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can CRUD invoices" ON public.invoices
  FOR ALL TO authenticated USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());

-- Trigger to update cameras_count on clients
CREATE OR REPLACE FUNCTION public.update_client_cameras_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.clients SET cameras_count = (
      SELECT COUNT(*) FROM public.cameras WHERE client_id = NEW.client_id
    ) WHERE id = NEW.client_id;
  END IF;
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE public.clients SET cameras_count = (
      SELECT COUNT(*) FROM public.cameras WHERE client_id = OLD.client_id
    ) WHERE id = OLD.client_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER cameras_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.cameras
FOR EACH ROW EXECUTE FUNCTION public.update_client_cameras_count();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_clients BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_cameras BEFORE UPDATE ON public.cameras FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_guards BEFORE UPDATE ON public.guards FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_alarms BEFORE UPDATE ON public.alarms FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_invoices BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-assign admin role on signup (for the first user / manual admin creation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
