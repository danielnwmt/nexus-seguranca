
-- 1. Fix auth_rate_limits: Add RLS policies so the security definer functions can operate
-- The table is accessed only by SECURITY DEFINER functions (check_rate_limit, reset_rate_limit, cleanup_old_rate_limits)
-- so we need a policy that allows the service role but blocks direct client access.
-- Since security definer functions bypass RLS, we just need to ensure no regular user can access it directly.

-- Block all direct access from authenticated/anon users (security definer functions bypass RLS)
CREATE POLICY "No direct access to rate limits"
ON public.auth_rate_limits
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- 2. Fix clients table: restrict sensitive fields exposure
-- Create a view that hides sensitive PII for non-admin users
-- For now, tighten the RLS policy to role-based access

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can CRUD clients" ON public.clients;

-- Admins can do everything
CREATE POLICY "Admins full access to clients"
ON public.clients
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- N2/N3 operators can read and update clients
CREATE POLICY "Operators can read clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'n2') OR 
  public.has_role(auth.uid(), 'n3')
);

CREATE POLICY "Operators can update clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'n2') OR 
  public.has_role(auth.uid(), 'n3')
)
WITH CHECK (
  public.has_role(auth.uid(), 'n2') OR 
  public.has_role(auth.uid(), 'n3')
);

-- N1 can only read clients (view-only)
CREATE POLICY "N1 can read clients"
ON public.clients
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'n1'));

-- 3. Fix bank_configs: Add audit logging table and trigger
CREATE TABLE IF NOT EXISTS public.bank_configs_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_config_id UUID NOT NULL,
  action TEXT NOT NULL,
  user_id UUID,
  accessed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT
);

ALTER TABLE public.bank_configs_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins can read bank audit logs"
ON public.bank_configs_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No direct inserts from clients - only via trigger
CREATE POLICY "No direct insert to audit"
ON public.bank_configs_audit
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_bank_config_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.bank_configs_audit (bank_config_id, action, user_id)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit trigger to bank_configs
DROP TRIGGER IF EXISTS audit_bank_configs ON public.bank_configs;
CREATE TRIGGER audit_bank_configs
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_configs
  FOR EACH ROW EXECUTE FUNCTION public.audit_bank_config_access();
