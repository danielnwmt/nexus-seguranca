
-- Fix search_path on handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix the overly permissive RLS on company_settings (replace true with auth check)
DROP POLICY IF EXISTS "Allow all access to company_settings" ON public.company_settings;
CREATE POLICY "Authenticated users can access company_settings" ON public.company_settings
  FOR ALL TO authenticated USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());
