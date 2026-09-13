ALTER FUNCTION public.is_authenticated() SET SCHEMA private;
ALTER FUNCTION public.current_seller_id() SET SCHEMA private;
ALTER FUNCTION public.current_client_user_id() SET SCHEMA private;

REVOKE ALL ON FUNCTION private.is_authenticated() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_seller_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_client_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_authenticated() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_seller_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_client_user_id() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';