
-- 1. company_settings: remove any remaining public anon SELECT policy
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'public.company_settings'::regclass LOOP
    IF pol.polname ILIKE '%public%' OR pol.polname ILIKE '%anon%' OR pol.polname ILIKE '%everyone%' THEN
      EXECUTE format('DROP POLICY %I ON public.company_settings', pol.polname);
    END IF;
  END LOOP;
END $$;
REVOKE SELECT ON public.company_settings FROM anon;

-- 2. clients: replace blanket n1 read with self-scoped read
DROP POLICY IF EXISTS "N1 can read clients" ON public.clients;
CREATE POLICY "N1 can read own client record"
ON public.clients
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'n1'::app_role)
  AND user_id = auth.uid()
);

-- 3. guards & installers: restrict to admin only (operators no longer see PII of all field staff)
DROP POLICY IF EXISTS "Operators can read guards" ON public.guards;
CREATE POLICY "Admins can read guards"
ON public.guards FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Operators can read installers" ON public.installers;
CREATE POLICY "Admins can read installers"
ON public.installers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. media_servers & storage_servers: restrict to admin only
DROP POLICY IF EXISTS "Operators can read media_servers" ON public.media_servers;
CREATE POLICY "Admins can read media_servers"
ON public.media_servers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Operators can read storage_servers" ON public.storage_servers;
CREATE POLICY "Admins can read storage_servers"
ON public.storage_servers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. SECURITY DEFINER functions: revoke EXECUTE from PUBLIC, anon, authenticated.
-- Re-grant only the role-check helper that RLS policies depend on.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   f.nspname, f.proname, f.args);
  END LOOP;
END $$;

-- Re-grant has_role to authenticated (required by RLS policies)
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.has_role(%s) TO authenticated', f.args);
  END LOOP;
END $$;
