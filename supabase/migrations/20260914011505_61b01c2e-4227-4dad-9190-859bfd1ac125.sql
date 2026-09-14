ALTER TABLE public.saas_companies
ADD COLUMN subdomain text;

UPDATE public.saas_companies
SET subdomain = trim(both '-' from lower(regexp_replace(translate(name, 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'), '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || substr(replace(id::text, '-', ''), 1, 6)
WHERE subdomain IS NULL;

ALTER TABLE public.saas_companies
ALTER COLUMN subdomain SET NOT NULL;

ALTER TABLE public.saas_companies
ADD CONSTRAINT saas_companies_subdomain_format CHECK (subdomain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$');

CREATE UNIQUE INDEX saas_companies_subdomain_unique ON public.saas_companies (lower(subdomain));

CREATE OR REPLACE FUNCTION public.get_saas_company_by_subdomain(_subdomain text)
RETURNS TABLE (
  id uuid,
  name text,
  logo_url text,
  login_bg_url text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.logo_url, c.login_bg_url, c.status
  FROM public.saas_companies c
  WHERE lower(c.subdomain) = lower(trim(_subdomain))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_saas_company_by_subdomain(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saas_company_by_subdomain(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';