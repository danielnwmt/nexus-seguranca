ALTER FUNCTION public.get_owner_dashboard_stats() SECURITY INVOKER;
NOTIFY pgrst, 'reload schema';