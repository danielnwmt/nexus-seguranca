
-- 1. Fix handle_new_user: assign 'n1' by default, only first user gets admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'n1');
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Secure has_role: restrict checking other users' roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id != auth.uid() AND NOT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- 3. Make client-cameras bucket private
UPDATE storage.buckets SET public = false WHERE id = 'client-cameras';

-- 4. Replace permissive storage policy with authenticated-only
DROP POLICY IF EXISTS "Allow all access to client-cameras" ON storage.objects;

CREATE POLICY "Authenticated upload client-cameras"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-cameras');

CREATE POLICY "Authenticated read client-cameras"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-cameras');

CREATE POLICY "Authenticated update client-cameras"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-cameras');

CREATE POLICY "Authenticated delete client-cameras"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-cameras');
