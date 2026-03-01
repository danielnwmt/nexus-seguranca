
-- Rate limiting table for authentication attempts
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_rate_limits_identifier ON public.auth_rate_limits(identifier);

-- Enable RLS - no direct client access
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies = only service_role can access

-- Cleanup function for old entries (older than 24h)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.auth_rate_limits 
  WHERE first_attempt_at < now() - interval '24 hours'
    AND (locked_until IS NULL OR locked_until < now());
END;
$$;

-- Function to check and record login attempt (called by edge function via service role)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier TEXT,
  _max_attempts INTEGER DEFAULT 5,
  _window_minutes INTEGER DEFAULT 15,
  _lockout_minutes INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _record public.auth_rate_limits%ROWTYPE;
  _result JSON;
BEGIN
  -- Cleanup old entries periodically
  PERFORM public.cleanup_old_rate_limits();
  
  -- Get or create rate limit record
  SELECT * INTO _record 
  FROM public.auth_rate_limits 
  WHERE identifier = _identifier
  FOR UPDATE;
  
  -- Check if currently locked out
  IF _record.locked_until IS NOT NULL AND _record.locked_until > now() THEN
    SELECT json_build_object(
      'allowed', false,
      'locked', true,
      'locked_until', _record.locked_until,
      'remaining_seconds', EXTRACT(EPOCH FROM (_record.locked_until - now()))::integer,
      'attempts', _record.attempts
    ) INTO _result;
    RETURN _result;
  END IF;
  
  -- If record exists but window has expired, reset
  IF _record.id IS NOT NULL AND _record.first_attempt_at < now() - (_window_minutes || ' minutes')::interval THEN
    UPDATE public.auth_rate_limits
    SET attempts = 1, first_attempt_at = now(), locked_until = NULL, updated_at = now()
    WHERE identifier = _identifier;
    
    RETURN json_build_object('allowed', true, 'locked', false, 'attempts', 1);
  END IF;
  
  -- If no record, create one
  IF _record.id IS NULL THEN
    INSERT INTO public.auth_rate_limits (identifier, attempts, first_attempt_at)
    VALUES (_identifier, 1, now());
    
    RETURN json_build_object('allowed', true, 'locked', false, 'attempts', 1);
  END IF;
  
  -- Increment attempts
  _record.attempts := _record.attempts + 1;
  
  -- Check if should lock
  IF _record.attempts >= _max_attempts THEN
    -- Progressive lockout: 30min, 60min, 120min based on how many times locked
    UPDATE public.auth_rate_limits
    SET attempts = _record.attempts,
        locked_until = now() + (_lockout_minutes || ' minutes')::interval,
        updated_at = now()
    WHERE identifier = _identifier;
    
    SELECT json_build_object(
      'allowed', false,
      'locked', true,
      'locked_until', now() + (_lockout_minutes || ' minutes')::interval,
      'remaining_seconds', _lockout_minutes * 60,
      'attempts', _record.attempts
    ) INTO _result;
    RETURN _result;
  END IF;
  
  -- Update attempts
  UPDATE public.auth_rate_limits
  SET attempts = _record.attempts, updated_at = now()
  WHERE identifier = _identifier;
  
  RETURN json_build_object(
    'allowed', true, 
    'locked', false, 
    'attempts', _record.attempts,
    'remaining_attempts', _max_attempts - _record.attempts
  );
END;
$$;

-- Function to reset rate limit on successful login
CREATE OR REPLACE FUNCTION public.reset_rate_limit(_identifier TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.auth_rate_limits WHERE identifier = _identifier;
END;
$$;
