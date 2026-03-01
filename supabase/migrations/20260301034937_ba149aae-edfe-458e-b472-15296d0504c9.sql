
-- =====================================================
-- Fix ALL overly permissive RLS policies
-- Apply role-based access to all remaining tables
-- =====================================================

-- 1. CAMERAS: Admin/n2/n3 full, n1 read-only
DROP POLICY IF EXISTS "Authenticated users can CRUD cameras" ON public.cameras;

CREATE POLICY "Admins full access to cameras"
ON public.cameras FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can manage cameras"
ON public.cameras FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'))
WITH CHECK (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'));

CREATE POLICY "N1 can read cameras"
ON public.cameras FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n1'));

-- 2. ALARMS: Admin/n2/n3 full, n1 read-only
DROP POLICY IF EXISTS "Authenticated users can CRUD alarms" ON public.alarms;

CREATE POLICY "Admins full access to alarms"
ON public.alarms FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can manage alarms"
ON public.alarms FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'))
WITH CHECK (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'));

CREATE POLICY "N1 can read alarms"
ON public.alarms FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n1'));

-- 3. INVOICES: Admin full, n2/n3 read, n1 no access
DROP POLICY IF EXISTS "Authenticated users can CRUD invoices" ON public.invoices;

CREATE POLICY "Admins full access to invoices"
ON public.invoices FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can read invoices"
ON public.invoices FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'));

-- 4. BILLS: Admin full, n2/n3 read-only
DROP POLICY IF EXISTS "Authenticated users can CRUD bills" ON public.bills;

CREATE POLICY "Admins full access to bills"
ON public.bills FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can read bills"
ON public.bills FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'));

-- 5. SERVICE_ORDERS: Admin/n2/n3 full, n1 read-only
DROP POLICY IF EXISTS "auth_crud_service_orders" ON public.service_orders;

CREATE POLICY "Admins full access to service_orders"
ON public.service_orders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can manage service_orders"
ON public.service_orders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'))
WITH CHECK (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'));

CREATE POLICY "N1 can read service_orders"
ON public.service_orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n1'));

-- 6. PATROL_ROUTES: Admin/n2/n3 full, n1 read-only
DROP POLICY IF EXISTS "Authenticated users can CRUD patrol_routes" ON public.patrol_routes;

CREATE POLICY "Admins full access to patrol_routes"
ON public.patrol_routes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can manage patrol_routes"
ON public.patrol_routes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'))
WITH CHECK (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'));

CREATE POLICY "N1 can read patrol_routes"
ON public.patrol_routes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n1'));

-- 7. ANALYTICS_EVENTS: Admin/n2/n3 full, n1 read-only
DROP POLICY IF EXISTS "Authenticated users can CRUD analytics_events" ON public.analytics_events;

CREATE POLICY "Admins full access to analytics_events"
ON public.analytics_events FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can manage analytics_events"
ON public.analytics_events FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'))
WITH CHECK (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'));

CREATE POLICY "N1 can read analytics_events"
ON public.analytics_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n1'));

-- 8. RECORDINGS: Admin full, n2/n3 read, n1 read-only
DROP POLICY IF EXISTS "Authenticated users can CRUD recordings" ON public.recordings;

CREATE POLICY "Admins full access to recordings"
ON public.recordings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can read recordings"
ON public.recordings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'));

CREATE POLICY "N1 can read recordings"
ON public.recordings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n1'));

-- 9. MEDIA_SERVERS: Admin only full, others read-only
DROP POLICY IF EXISTS "Authenticated users can CRUD media_servers" ON public.media_servers;

CREATE POLICY "Admins full access to media_servers"
ON public.media_servers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can read media_servers"
ON public.media_servers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'));

-- 10. STORAGE_SERVERS: Admin only full, others read-only
DROP POLICY IF EXISTS "auth_crud" ON public.storage_servers;

CREATE POLICY "Admins full access to storage_servers"
ON public.storage_servers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can read storage_servers"
ON public.storage_servers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'n2') OR public.has_role(auth.uid(), 'n3'));

-- 11. Fix BANK_CONFIGS: Recreate with explicit TO authenticated
DROP POLICY IF EXISTS "admin_access_bank_configs" ON public.bank_configs;

CREATE POLICY "Admins full access to bank_configs"
ON public.bank_configs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
