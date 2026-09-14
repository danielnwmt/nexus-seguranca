ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS browser_title text;

ALTER TABLE public.saas_companies
ADD COLUMN IF NOT EXISTS browser_title text;

UPDATE public.company_settings
SET browser_title = COALESCE(NULLIF(browser_title, ''), name || ' | Monitoramento');

UPDATE public.saas_companies
SET browser_title = COALESCE(NULLIF(browser_title, ''), name || ' | Monitoramento');

NOTIFY pgrst, 'reload schema';