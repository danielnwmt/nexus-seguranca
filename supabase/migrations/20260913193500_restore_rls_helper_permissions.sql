-- Restore only the helper functions required by existing authenticated RLS policies.
GRANT EXECUTE ON FUNCTION public.is_authenticated() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_seller_id() TO authenticated;
NOTIFY pgrst, 'reload schema';
