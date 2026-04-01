ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS sellers_user_id_unique_idx
ON public.sellers (user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_seller_id_idx
ON public.clients (seller_id)
WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.current_seller_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.sellers
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

DROP POLICY IF EXISTS "Seller can read own profile" ON public.sellers;
CREATE POLICY "Seller can read own profile"
ON public.sellers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Seller can read own clients" ON public.clients;
CREATE POLICY "Seller can read own clients"
ON public.clients
FOR SELECT
TO authenticated
USING (seller_id = public.current_seller_id());

DROP POLICY IF EXISTS "Seller can create own clients" ON public.clients;
CREATE POLICY "Seller can create own clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (seller_id = public.current_seller_id());

DROP POLICY IF EXISTS "Seller can update own clients" ON public.clients;
CREATE POLICY "Seller can update own clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (seller_id = public.current_seller_id())
WITH CHECK (seller_id = public.current_seller_id());