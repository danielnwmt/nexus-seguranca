
-- Fix clients table: drop RESTRICTIVE policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Admins full access to clients" ON public.clients;
DROP POLICY IF EXISTS "N1 can read clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can read clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can update clients" ON public.clients;

CREATE POLICY "Admins full access to clients" ON public.clients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "N1 can read clients" ON public.clients FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n1'::app_role));

CREATE POLICY "Operators can read clients" ON public.clients FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

CREATE POLICY "Operators can update clients" ON public.clients FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role))
  WITH CHECK (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));
