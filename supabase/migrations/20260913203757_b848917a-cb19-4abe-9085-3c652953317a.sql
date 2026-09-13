CREATE TABLE public.saas_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  email text,
  phone text,
  plan_name text NOT NULL DEFAULT 'Personalizado',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_companies TO authenticated;
GRANT ALL ON public.saas_companies TO service_role;
ALTER TABLE public.saas_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages SaaS companies" ON public.saas_companies
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'owner'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'owner'::public.app_role));

CREATE TABLE public.saas_company_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.saas_companies(id) ON DELETE CASCADE,
  module text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_company_features TO authenticated;
GRANT ALL ON public.saas_company_features TO service_role;
ALTER TABLE public.saas_company_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages company features" ON public.saas_company_features
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'owner'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'owner'::public.app_role));

CREATE TABLE public.saas_company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.saas_companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_company_users TO authenticated;
GRANT ALL ON public.saas_company_users TO service_role;
ALTER TABLE public.saas_company_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages company users" ON public.saas_company_users
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'owner'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'owner'::public.app_role));

CREATE POLICY "Users view own company membership" ON public.saas_company_users
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users view own SaaS company" ON public.saas_companies
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.saas_company_users scu
  WHERE scu.company_id = saas_companies.id AND scu.user_id = auth.uid()
));

CREATE POLICY "Users view enabled company features" ON public.saas_company_features
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.saas_company_users scu
  WHERE scu.company_id = saas_company_features.company_id AND scu.user_id = auth.uid()
));

CREATE TRIGGER set_updated_at_saas_companies
BEFORE UPDATE ON public.saas_companies
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_saas_company_features
BEFORE UPDATE ON public.saas_company_features
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

NOTIFY pgrst, 'reload schema';