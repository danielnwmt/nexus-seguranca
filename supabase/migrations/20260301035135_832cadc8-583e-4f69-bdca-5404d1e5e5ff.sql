
-- 1. Fix race condition in handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count integer;
BEGIN
  -- Lock the table to prevent race condition
  PERFORM 1 FROM public.user_roles FOR UPDATE;
  
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'n1');
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Fix user_roles: restrict read to own roles + admins
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.user_roles;

CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can read all roles"
ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
