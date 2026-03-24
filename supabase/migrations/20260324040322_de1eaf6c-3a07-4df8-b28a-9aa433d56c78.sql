CREATE OR REPLACE VIEW public.company_branding_public
WITH (security_invoker = on) AS
SELECT id, name, logo_url, login_bg_url
FROM public.company_settings;

GRANT SELECT ON public.company_branding_public TO anon, authenticated;

CREATE POLICY "Public can read company branding"
ON public.company_settings
FOR SELECT
TO anon
USING (true);