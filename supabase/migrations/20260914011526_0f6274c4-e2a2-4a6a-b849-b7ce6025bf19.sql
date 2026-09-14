REVOKE ALL ON FUNCTION public.get_saas_company_by_subdomain(text) FROM anon, authenticated, service_role, PUBLIC;
DROP FUNCTION public.get_saas_company_by_subdomain(text);
NOTIFY pgrst, 'reload schema';