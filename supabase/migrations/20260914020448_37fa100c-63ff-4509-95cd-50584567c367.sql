ALTER TABLE public.saas_companies
ADD COLUMN domain_type text NOT NULL DEFAULT 'subdomain',
ADD COLUMN custom_domain text;

ALTER TABLE public.saas_companies
ADD CONSTRAINT saas_companies_domain_type_check
CHECK (domain_type IN ('subdomain', 'custom'));

ALTER TABLE public.saas_companies
ADD CONSTRAINT saas_companies_custom_domain_check
CHECK (
  custom_domain IS NULL OR custom_domain ~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
);

ALTER TABLE public.saas_companies
ADD CONSTRAINT saas_companies_domain_selection_check
CHECK (
  (domain_type = 'subdomain' AND custom_domain IS NULL)
  OR
  (domain_type = 'custom' AND custom_domain IS NOT NULL)
);

CREATE UNIQUE INDEX saas_companies_custom_domain_unique
ON public.saas_companies (lower(custom_domain))
WHERE custom_domain IS NOT NULL;

NOTIFY pgrst, 'reload schema';