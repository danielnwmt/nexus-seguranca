CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN _user_id <> auth.uid() AND auth.role() <> 'service_role' THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND (role = _role OR (role = 'owner'::public.app_role AND _role = 'admin'::public.app_role))
    )
  END
$function$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_owner_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  RETURN jsonb_build_object(
    'clients_total', (SELECT count(*) FROM public.clients WHERE deleted_at IS NULL),
    'clients_active', (SELECT count(*) FROM public.clients WHERE deleted_at IS NULL AND status = 'active'),
    'users_total', (SELECT count(DISTINCT user_id) FROM public.user_roles),
    'cameras_total', (SELECT count(*) FROM public.cameras WHERE deleted_at IS NULL),
    'cameras_online', (SELECT count(*) FROM public.cameras WHERE deleted_at IS NULL AND status = 'online'),
    'alarms_open', (SELECT count(*) FROM public.alarms WHERE acknowledged = false),
    'recordings_total', (SELECT count(*) FROM public.recordings),
    'storage_servers_total', (SELECT count(*) FROM public.storage_servers),
    'cloud_storages_total', (SELECT count(*) FROM public.cloud_storages),
    'monthly_revenue', (SELECT COALESCE(sum(monthly_fee), 0) FROM public.clients WHERE deleted_at IS NULL AND status = 'active')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_owner_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_stats() TO authenticated, service_role;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role
FROM auth.users
WHERE lower(email) = 'suporte@protenexus.com'
  AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

NOTIFY pgrst, 'reload schema';