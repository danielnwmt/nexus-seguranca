CREATE OR REPLACE FUNCTION public.current_saas_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT scu.company_id FROM public.saas_company_users scu JOIN public.saas_companies sc ON sc.id = scu.company_id WHERE scu.user_id = auth.uid() AND sc.status = 'active' ORDER BY scu.created_at LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.current_saas_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_saas_company_id() TO authenticated, service_role;

CREATE TABLE public.saas_company_billing (
 company_id uuid PRIMARY KEY REFERENCES public.saas_companies(id) ON DELETE CASCADE,
 price_per_camera numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_per_camera >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_company_billing TO authenticated;
GRANT ALL ON public.saas_company_billing TO service_role;
ALTER TABLE public.saas_company_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages SaaS billing" ON public.saas_company_billing FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'owner'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'owner'::public.app_role));

ALTER TABLE public.cameras ADD COLUMN company_id uuid REFERENCES public.saas_companies(id) DEFAULT public.current_saas_company_id();
UPDATE public.cameras SET company_id = (SELECT id FROM public.saas_companies LIMIT 1) WHERE company_id IS NULL AND (SELECT count(*) FROM public.saas_companies) = 1;
CREATE INDEX cameras_company_billing_idx ON public.cameras(company_id) WHERE deleted_at IS NULL;
ALTER TABLE public.bills ADD COLUMN company_id uuid REFERENCES public.saas_companies(id) DEFAULT public.current_saas_company_id();
UPDATE public.bills SET company_id = (SELECT id FROM public.saas_companies LIMIT 1) WHERE company_id IS NULL AND (SELECT count(*) FROM public.saas_companies) = 1;
CREATE INDEX bills_company_idx ON public.bills(company_id);
CREATE POLICY "Bills isolated by company" ON public.bills AS RESTRICTIVE FOR ALL TO authenticated USING (company_id = public.current_saas_company_id() AND EXISTS (SELECT 1 FROM public.saas_company_features f WHERE f.company_id = bills.company_id AND f.module = 'financial' AND f.enabled)) WITH CHECK (company_id = public.current_saas_company_id() AND EXISTS (SELECT 1 FROM public.saas_company_features f WHERE f.company_id = bills.company_id AND f.module = 'financial' AND f.enabled));

CREATE OR REPLACE FUNCTION public.get_saas_company_billing()
RETURNS TABLE(company_id uuid, price_per_camera numeric, cameras_count bigint, monthly_fee numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
 IF NOT private.has_role(auth.uid(), 'owner'::public.app_role) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 RETURN QUERY SELECT sc.id, COALESCE(b.price_per_camera, 0::numeric), count(c.id), COALESCE(b.price_per_camera, 0::numeric) * count(c.id)
 FROM public.saas_companies sc LEFT JOIN public.saas_company_billing b ON b.company_id = sc.id LEFT JOIN public.cameras c ON c.company_id = sc.id AND c.deleted_at IS NULL
 GROUP BY sc.id, b.price_per_camera;
END;
$$;
REVOKE ALL ON FUNCTION public.get_saas_company_billing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_saas_company_billing() TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';