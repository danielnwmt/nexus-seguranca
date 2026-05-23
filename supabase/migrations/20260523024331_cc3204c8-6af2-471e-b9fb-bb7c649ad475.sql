
-- 1. Remove acesso público ao company_settings (mantém leitura via view company_branding_public)
DROP POLICY IF EXISTS "Public can read company branding" ON public.company_settings;

-- 2. RLS no realtime.messages para escopar assinaturas
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive authorized realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive authorized realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'n2'::app_role)
  OR public.has_role(auth.uid(), 'n3'::app_role)
);

-- 3. Storage: restringir client-cameras a admin + operadores
DROP POLICY IF EXISTS "Authenticated can read client-cameras" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload client-cameras" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update client-cameras" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete client-cameras" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;

CREATE POLICY "client-cameras admin/operators read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-cameras' AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'n2'::app_role)
    OR public.has_role(auth.uid(), 'n3'::app_role)
  )
);

CREATE POLICY "client-cameras admin/operators insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-cameras' AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'n2'::app_role)
    OR public.has_role(auth.uid(), 'n3'::app_role)
  )
);

CREATE POLICY "client-cameras admin/operators update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-cameras' AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'n2'::app_role)
    OR public.has_role(auth.uid(), 'n3'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'client-cameras' AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'n2'::app_role)
    OR public.has_role(auth.uid(), 'n3'::app_role)
  )
);

CREATE POLICY "client-cameras admin/operators delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-cameras' AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'n2'::app_role)
    OR public.has_role(auth.uid(), 'n3'::app_role)
  )
);
