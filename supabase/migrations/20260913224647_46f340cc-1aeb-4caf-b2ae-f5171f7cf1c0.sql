UPDATE public.user_roles
SET role = 'admin'::public.app_role
WHERE user_id IN (SELECT user_id FROM public.saas_company_users)
  AND role = 'n1'::public.app_role;

NOTIFY pgrst, 'reload schema';