ALTER TABLE public.saas_companies
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS login_bg_url text,
  ADD COLUMN IF NOT EXISTS recording_segment_minutes integer NOT NULL DEFAULT 30;

DROP POLICY IF EXISTS "Company admins update own SaaS company" ON public.saas_companies;
CREATE POLICY "Company admins update own SaaS company"
ON public.saas_companies
FOR UPDATE
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.saas_company_users scu
    WHERE scu.company_id = saas_companies.id
      AND scu.user_id = auth.uid()
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.saas_company_users scu
    WHERE scu.company_id = saas_companies.id
      AND scu.user_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';