
-- Add user_id column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid;

-- Create a function to get current client id from auth
CREATE OR REPLACE FUNCTION public.current_client_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.clients
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Add RLS policy so clients can read their own cameras
CREATE POLICY "Client can read own cameras"
ON public.cameras
FOR SELECT
TO authenticated
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- Add RLS policy so clients can read their own recordings
CREATE POLICY "Client can read own recordings"
ON public.recordings
FOR SELECT
TO authenticated
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- Add RLS policy so clients can read their own alarms
CREATE POLICY "Client can read own alarms"
ON public.alarms
FOR SELECT
TO authenticated
USING (
  camera_id IN (
    SELECT c.id FROM public.cameras c
    JOIN public.clients cl ON c.client_id = cl.id
    WHERE cl.user_id = auth.uid()
  )
);
