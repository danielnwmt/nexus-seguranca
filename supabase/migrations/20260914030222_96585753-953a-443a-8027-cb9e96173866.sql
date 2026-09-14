CREATE OR REPLACE VIEW public.company_branding_public
WITH (security_invoker = on) AS
SELECT id, name, logo_url, login_bg_url, browser_title
FROM public.company_settings;

GRANT SELECT ON public.company_branding_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';