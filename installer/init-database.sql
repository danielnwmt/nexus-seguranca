-- ============================================================
--  Nexus Monitoramento — Inicializacao do Banco de Dados
--  PostgreSQL + PostgREST (sem Docker/Supabase)
--  IDEMPOTENTE: pode ser executado multiplas vezes sem erro
-- ============================================================

-- 0. Extensao pgcrypto (necessaria ANTES de usar crypt/gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Criar roles para PostgREST
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'nexus_auth_2024';
  END IF;
END
$$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;

-- 2. Schema de autenticacao (simula auth.users do Supabase)
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  email_confirmed_at TIMESTAMPTZ DEFAULT now(),
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);

-- Funcao para verificar usuario autenticado (compativel com PostgREST JWT)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::UUID
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'role', '')::TEXT
$$;

-- 3. Enum de roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'n1', 'n2', 'n3');
  END IF;
END
$$;

-- 4. Tabelas principais
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  cameras_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  monthly_fee NUMERIC,
  payment_due_day INTEGER,
  storage_server_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  stream_url TEXT,
  stream_key TEXT NOT NULL DEFAULT '',
  snapshot_url TEXT,
  protocol TEXT DEFAULT 'RTSP',
  status TEXT DEFAULT 'online',
  location TEXT,
  resolution TEXT,
  brand TEXT,
  video_encoding TEXT,
  max_bitrate INTEGER,
  storage_path TEXT,
  retention_days INTEGER DEFAULT 30,
  analytics TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  email TEXT,
  cnv TEXT,
  city TEXT,
  state TEXT,
  shift TEXT DEFAULT 'day',
  status TEXT DEFAULT 'active',
  client_ids TEXT[],
  hire_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id UUID REFERENCES public.cameras(id) ON DELETE SET NULL,
  camera_name TEXT,
  client_name TEXT,
  type TEXT DEFAULT 'motion',
  severity TEXT DEFAULT 'medium',
  message TEXT,
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  amount NUMERIC DEFAULT 0,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  bank TEXT,
  paid_at DATE,
  boleto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  amount NUMERIC DEFAULT 0,
  due_date DATE,
  paid_at DATE,
  status TEXT DEFAULT 'pending',
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT DEFAULT 'Nexus Segurança',
  razao_social TEXT,
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  media_server_ip TEXT DEFAULT '',
  login_bg_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL DEFAULT '',
  max_storage_gb INTEGER DEFAULT 1000,
  status TEXT DEFAULT 'active',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Servidor MediaMTX',
  ip_address TEXT NOT NULL DEFAULT '',
  instances INTEGER NOT NULL DEFAULT 1,
  rtmp_base_port INTEGER NOT NULL DEFAULT 1935,
  hls_base_port INTEGER NOT NULL DEFAULT 8888,
  webrtc_base_port INTEGER NOT NULL DEFAULT 8889,
  os TEXT NOT NULL DEFAULT 'linux',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Garantir colunas em instalacoes existentes (ALTER ADD IF NOT EXISTS)
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS stream_key TEXT NOT NULL DEFAULT '';
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS snapshot_url TEXT;
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS video_encoding TEXT;
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS max_bitrate INTEGER;
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS cnv TEXT;
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS storage_server_id UUID;

-- Garantir coluna os em instalacoes existentes
ALTER TABLE public.media_servers ADD COLUMN IF NOT EXISTS os TEXT NOT NULL DEFAULT 'linux';

CREATE TABLE IF NOT EXISTS public.recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id UUID REFERENCES public.cameras(id) ON DELETE SET NULL,
  camera_name TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  file_path TEXT NOT NULL DEFAULT '',
  file_size_mb NUMERIC DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  start_time TIMESTAMPTZ DEFAULT now(),
  end_time TIMESTAMPTZ,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id UUID REFERENCES public.cameras(id) ON DELETE SET NULL,
  camera_name TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  event_type TEXT NOT NULL DEFAULT 'motion',
  confidence NUMERIC DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL DEFAULT ('OS-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 4)),
  type TEXT NOT NULL DEFAULT 'installation',
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  notes TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  installer_id UUID,
  installer_name TEXT,
  scheduled_date DATE,
  completed_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.installers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  phone TEXT,
  specialty TEXT DEFAULT 'cameras',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patrol_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Ronda',
  description TEXT,
  guard_id UUID REFERENCES public.guards(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  city TEXT,
  waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank TEXT NOT NULL,
  label TEXT NOT NULL,
  agencia TEXT DEFAULT '',
  conta TEXT DEFAULT '',
  convenio TEXT DEFAULT '',
  api_key_encrypted TEXT DEFAULT '',
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_configs_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_config_id TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  ip_address TEXT,
  accessed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  role app_role DEFAULT 'n1'
);

-- 5. Funcoes auxiliares
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_client_cameras_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'n1')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_cameras_updated_at ON public.cameras;
CREATE TRIGGER update_cameras_updated_at
  BEFORE UPDATE ON public.cameras
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_guards_updated_at ON public.guards;
CREATE TRIGGER update_guards_updated_at
  BEFORE UPDATE ON public.guards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_alarms_updated_at ON public.alarms;
CREATE TRIGGER update_alarms_updated_at
  BEFORE UPDATE ON public.alarms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_cameras_count ON public.cameras;
CREATE TRIGGER update_cameras_count
  AFTER INSERT OR UPDATE OF client_id OR DELETE ON public.cameras
  FOR EACH ROW EXECUTE FUNCTION public.update_client_cameras_count();

-- 7. RLS (Row Level Security)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_configs_audit ENABLE ROW LEVEL SECURITY;

-- Politicas: usuarios autenticados podem tudo (DROP + CREATE para idempotencia)
DROP POLICY IF EXISTS "auth_all_clients" ON public.clients;
CREATE POLICY "auth_all_clients" ON public.clients FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_cameras" ON public.cameras;
CREATE POLICY "auth_all_cameras" ON public.cameras FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_guards" ON public.guards;
CREATE POLICY "auth_all_guards" ON public.guards FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_alarms" ON public.alarms;
CREATE POLICY "auth_all_alarms" ON public.alarms FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_invoices" ON public.invoices;
CREATE POLICY "auth_all_invoices" ON public.invoices FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_bills" ON public.bills;
CREATE POLICY "auth_all_bills" ON public.bills FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_company" ON public.company_settings;
CREATE POLICY "auth_all_company" ON public.company_settings FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_roles" ON public.user_roles;
CREATE POLICY "auth_all_roles" ON public.user_roles FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_storage" ON public.storage_servers;
CREATE POLICY "auth_all_storage" ON public.storage_servers FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_media" ON public.media_servers;
CREATE POLICY "auth_all_media" ON public.media_servers FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_recordings" ON public.recordings;
CREATE POLICY "auth_all_recordings" ON public.recordings FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_analytics" ON public.analytics_events;
CREATE POLICY "auth_all_analytics" ON public.analytics_events FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_service_orders" ON public.service_orders;
CREATE POLICY "auth_all_service_orders" ON public.service_orders FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_installers" ON public.installers;
CREATE POLICY "auth_all_installers" ON public.installers FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_patrol_routes" ON public.patrol_routes;
CREATE POLICY "auth_all_patrol_routes" ON public.patrol_routes FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_bank_configs" ON public.bank_configs;
CREATE POLICY "auth_all_bank_configs" ON public.bank_configs FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_all_rate_limits" ON public.auth_rate_limits;
CREATE POLICY "auth_all_rate_limits" ON public.auth_rate_limits FOR ALL USING (false);

DROP POLICY IF EXISTS "auth_all_bank_audit" ON public.bank_configs_audit;
CREATE POLICY "auth_all_bank_audit" ON public.bank_configs_audit FOR ALL USING (auth.uid() IS NOT NULL);

-- 8. Permissoes para PostgREST
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT SELECT ON auth.users TO authenticated;

-- 9. Dados iniciais
INSERT INTO public.company_settings (name) 
VALUES ('Nexus Segurança')
ON CONFLICT DO NOTHING;

-- 10. Usuario administrador padrao (apenas primeiro setup)
INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
VALUES (
  'admin@protenexus.com',
  crypt('1234', gen_salt('bf')),
  '{"force_password_change": true}'::jsonb
)
ON CONFLICT (email) DO NOTHING;

-- Garantir que o admin tem role (trigger pode nao disparar em ON CONFLICT UPDATE)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'admin@protenexus.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin'::app_role;

-- 10. Funcao de login (retorna JWT claims)
CREATE OR REPLACE FUNCTION public.login(email TEXT, pass TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _user auth.users%ROWTYPE;
  result JSON;
BEGIN
  SELECT * INTO _user FROM auth.users
  WHERE auth.users.email = login.email
  AND auth.users.encrypted_password = crypt(pass, auth.users.encrypted_password);

  IF _user.id IS NULL THEN
    RAISE EXCEPTION 'Invalid email or password';
  END IF;

  SELECT json_build_object(
    'sub', _user.id,
    'email', _user.email,
    'role', 'authenticated',
    'iat', extract(epoch from now())::integer,
    'exp', extract(epoch from now() + interval '24 hours')::integer
  ) INTO result;

  RETURN result;
END;
$$;

-- Funcao de registro
CREATE OR REPLACE FUNCTION public.signup(email TEXT, pass TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _user auth.users%ROWTYPE;
  result JSON;
BEGIN
  INSERT INTO auth.users (email, encrypted_password)
  VALUES (signup.email, crypt(pass, gen_salt('bf')))
  RETURNING * INTO _user;

  SELECT json_build_object(
    'sub', _user.id,
    'email', _user.email,
    'role', 'authenticated'
  ) INTO result;

  RETURN result;
END;
$$;

-- Permitir login/signup para anon
GRANT EXECUTE ON FUNCTION public.login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.signup(TEXT, TEXT) TO anon;

-- Fim
DO $$ BEGIN RAISE NOTICE 'Banco de dados inicializado com sucesso!'; END $$;
