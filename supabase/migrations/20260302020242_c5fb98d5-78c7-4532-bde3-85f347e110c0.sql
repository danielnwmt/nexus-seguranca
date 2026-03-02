
-- Drop all existing restrictive policies on media_servers
DROP POLICY IF EXISTS "Admins full access to media_servers" ON public.media_servers;
DROP POLICY IF EXISTS "Operators can read media_servers" ON public.media_servers;

-- Create permissive policies
CREATE POLICY "Admins full access to media_servers"
  ON public.media_servers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can read media_servers"
  ON public.media_servers FOR SELECT
  USING (has_role(auth.uid(), 'n1'::app_role) OR has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));
