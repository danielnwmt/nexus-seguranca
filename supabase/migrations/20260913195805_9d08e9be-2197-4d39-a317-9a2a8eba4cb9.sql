-- Scope every legacy N1 read policy to the client account linked to auth.uid().
DROP POLICY IF EXISTS "N1 can read clients" ON public.clients;
CREATE POLICY "N1 can read own client"
ON public.clients FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n1') AND user_id = auth.uid());

DROP POLICY IF EXISTS "N1 can read cameras" ON public.cameras;
CREATE POLICY "N1 can read own cameras"
ON public.cameras FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'n1')
  AND EXISTS (
    SELECT 1 FROM public.clients cl
    WHERE cl.id = cameras.client_id AND cl.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "N1 can read alarms" ON public.alarms;
CREATE POLICY "N1 can read own alarms"
ON public.alarms FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'n1')
  AND (
    EXISTS (
      SELECT 1 FROM public.cameras c
      JOIN public.clients cl ON cl.id = c.client_id
      WHERE c.id = alarms.camera_id AND cl.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.alarm_panels ap
      JOIN public.clients cl ON cl.id = ap.client_id
      WHERE ap.id = alarms.panel_id AND cl.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "N1 can read analytics_events" ON public.analytics_events;
CREATE POLICY "N1 can read own analytics events"
ON public.analytics_events FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'n1')
  AND EXISTS (
    SELECT 1 FROM public.clients cl
    WHERE cl.id = analytics_events.client_id AND cl.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "N1 can read patrol_routes" ON public.patrol_routes;
CREATE POLICY "N1 can read own patrol routes"
ON public.patrol_routes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'n1')
  AND EXISTS (
    SELECT 1 FROM public.clients cl
    WHERE cl.id = patrol_routes.client_id AND cl.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Staff can view alarm panels" ON public.alarm_panels;
CREATE POLICY "Staff can view permitted alarm panels"
ON public.alarm_panels FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'n2')
  OR public.has_role(auth.uid(), 'n3')
  OR (
    public.has_role(auth.uid(), 'n1')
    AND EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.id = alarm_panels.client_id AND cl.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Staff can view alarm zones" ON public.alarm_zones;
CREATE POLICY "Staff can view permitted alarm zones"
ON public.alarm_zones FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'n2')
  OR public.has_role(auth.uid(), 'n3')
  OR (
    public.has_role(auth.uid(), 'n1')
    AND EXISTS (
      SELECT 1
      FROM public.alarm_panels ap
      JOIN public.clients cl ON cl.id = ap.client_id
      WHERE ap.id = alarm_zones.panel_id AND cl.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "N1 can read recordings" ON public.recordings;
CREATE POLICY "N1 can read own recordings"
ON public.recordings FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'n1')
  AND EXISTS (
    SELECT 1 FROM public.clients cl
    WHERE cl.id = recordings.client_id AND cl.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "N1 can read service_orders" ON public.service_orders;
CREATE POLICY "N1 can read own service orders"
ON public.service_orders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'n1')
  AND EXISTS (
    SELECT 1 FROM public.clients cl
    WHERE cl.id = service_orders.client_id AND cl.user_id = auth.uid()
  )
);

-- Replace bucket-wide authenticated access with role/ownership checks.
DROP POLICY IF EXISTS "Authenticated upload client-cameras" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read client-cameras" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update client-cameras" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete client-cameras" ON storage.objects;

CREATE POLICY "Authorized read client-cameras"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-cameras'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'n2')
    OR public.has_role(auth.uid(), 'n3')
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.user_id = auth.uid()
        AND (storage.foldername(name))[1] LIKE '%' || cl.id::text
    )
  )
);

CREATE POLICY "Authorized upload client-cameras"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-cameras'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'n2')
    OR public.has_role(auth.uid(), 'n3')
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.user_id = auth.uid()
        AND (storage.foldername(name))[1] LIKE '%' || cl.id::text
    )
  )
);

CREATE POLICY "Authorized update client-cameras"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-cameras'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'n2')
    OR public.has_role(auth.uid(), 'n3')
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.user_id = auth.uid()
        AND (storage.foldername(name))[1] LIKE '%' || cl.id::text
    )
  )
)
WITH CHECK (
  bucket_id = 'client-cameras'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'n2')
    OR public.has_role(auth.uid(), 'n3')
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.user_id = auth.uid()
        AND (storage.foldername(name))[1] LIKE '%' || cl.id::text
    )
  )
);

CREATE POLICY "Authorized delete client-cameras"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-cameras'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'n2')
    OR public.has_role(auth.uid(), 'n3')
    OR EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.user_id = auth.uid()
        AND (storage.foldername(name))[1] LIKE '%' || cl.id::text
    )
  )
);

NOTIFY pgrst, 'reload schema';