GRANT EXECUTE ON FUNCTION public.is_authenticated() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_seller_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_client_user_id() TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';