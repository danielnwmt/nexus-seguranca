DROP POLICY IF EXISTS "Authorized upload client-cameras" ON storage.objects;
DROP POLICY IF EXISTS "Authorized read client-cameras" ON storage.objects;
DROP POLICY IF EXISTS "Authorized update client-cameras" ON storage.objects;
DROP POLICY IF EXISTS "Authorized delete client-cameras" ON storage.objects;

CREATE POLICY "Authorized read client-cameras"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-cameras'
  AND (
    private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'n2')
    OR private.has_role(auth.uid(), 'n3')
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.user_id = auth.uid()
        AND (storage.foldername(name))[1] = cl.id::text
    )
  )
);

CREATE POLICY "Authorized upload client-cameras"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-cameras'
  AND (
    private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'n2')
    OR private.has_role(auth.uid(), 'n3')
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.user_id = auth.uid()
        AND (storage.foldername(name))[1] = cl.id::text
    )
  )
);

CREATE POLICY "Authorized update client-cameras"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-cameras'
  AND (
    private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'n2')
    OR private.has_role(auth.uid(), 'n3')
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.user_id = auth.uid()
        AND (storage.foldername(name))[1] = cl.id::text
    )
  )
)
WITH CHECK (
  bucket_id = 'client-cameras'
  AND (
    private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'n2')
    OR private.has_role(auth.uid(), 'n3')
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.user_id = auth.uid()
        AND (storage.foldername(name))[1] = cl.id::text
    )
  )
);

CREATE POLICY "Authorized delete client-cameras"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-cameras'
  AND (
    private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'n2')
    OR private.has_role(auth.uid(), 'n3')
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.user_id = auth.uid()
        AND (storage.foldername(name))[1] = cl.id::text
    )
  )
);

NOTIFY pgrst, 'reload schema';